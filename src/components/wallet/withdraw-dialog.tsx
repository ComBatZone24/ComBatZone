
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, X, Info, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { database } from '@/lib/firebase/config';
import { ref, push, runTransaction } from 'firebase/database';
import type { WithdrawRequest, User as AppUserType, WalletTransaction } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  DialogFooter,
} from "@/components/ui/dialog";

const MIN_WITHDRAWAL_AMOUNT = 300;

interface WithdrawDialogProps {
  firebaseUser: FirebaseUser | null;
  userProfile: AppUserType | null;
  onOpenChange: (open: boolean) => void; // For closing the dialog
  onSuccess?: () => void; // Callback for successful withdrawal
}

export default function WithdrawDialog({ firebaseUser, userProfile, onOpenChange, onSuccess }: WithdrawDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    handleResetForm();
  }, [userProfile]);


  const handleResetForm = () => {
    setAmount(''); setMethod(''); setAccountNumber(''); setAccountName(''); setLocalError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!firebaseUser || !userProfile) {
      setLocalError("You must be logged in and have a profile to make a withdrawal request.");
      toast({ title: "Authentication Error", description: "Please log in.", variant: "destructive" });
      return;
    }

    const withdrawalAmount = parseFloat(amount); // Ensure this is a number
    const userWalletBalance = Number(userProfile.wallet || 0);

    console.log(`WithdrawDialog (Client): Validating. Attempting: ${withdrawalAmount}, Client-side available: ${userWalletBalance}`);


    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      setLocalError("Please enter a valid amount to withdraw.");
      return;
    }
    if (withdrawalAmount < MIN_WITHDRAWAL_AMOUNT) {
      setLocalError(`Minimum withdrawal amount is Rs ${MIN_WITHDRAWAL_AMOUNT}.`);
      return;
    }
    
    if (withdrawalAmount > userWalletBalance) {
      console.error(`WithdrawDialog (Client): Validation FAILED. Withdrawal amount (${withdrawalAmount}) exceeds client-side wallet balance (${userWalletBalance}).`);
      setLocalError("Withdrawal amount cannot exceed your current wallet balance.");
      toast({ title: "Amount Error", description: "Withdrawal amount exceeds your current wallet balance. Please check the displayed available balance.", variant: "destructive" });
      return;
    }

    if (!method.trim()) {
      setLocalError("Please specify your withdrawal method.");
      return;
    }
    if (!accountNumber.trim()) {
      setLocalError("Please enter your account number/IBAN.");
      return;
    }
    if (!accountName.trim()) {
      setLocalError("Please enter the account holder's name.");
      return;
    }

    setIsSubmitting(true);
    console.log(`WithdrawDialog (Client): Attempting to submit Firebase transaction. User: ${firebaseUser.uid}, Amount: ${withdrawalAmount}`);
    console.log(`WithdrawDialog (Client): Client-side balance before transaction: ${userWalletBalance}`);

    try {
      if (!database) throw new Error("Firebase database not initialized");

      const userWalletRef = ref(database, `users/${firebaseUser.uid}/wallet`);
      let initialTransactionId: string | null = null;

      const walletUpdateResult = await runTransaction(userWalletRef, (currentBalance) => {
        // --- DETAILED LOGGING INSIDE TRANSACTION ---
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Transaction updater started.`);
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Raw currentBalance from DB:`, currentBalance, `(Type: ${typeof currentBalance})`);
        
        const currentBalanceInDb = Number(currentBalance || 0); // Ensure numeric conversion
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Parsed numeric currentBalanceInDb: ${currentBalanceInDb}`);
        
        const numericWithdrawalAmount = Number(withdrawalAmount); // Ensure withdrawal amount is also numeric here
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Numeric withdrawalAmount to check: ${numericWithdrawalAmount}`);

        if (currentBalance === null) {
            console.warn(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): User wallet node is null/missing in Firebase. Treating as 0.`);
        }

        if (currentBalanceInDb < numericWithdrawalAmount) {
          console.warn(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): SERVER-SIDE CHECK FAILED: Aborting transaction. Server balance (${currentBalanceInDb}) is less than withdrawal amount (${numericWithdrawalAmount}).`);
          return; // Abort transaction by returning undefined
        }
        
        const newBalance = currentBalanceInDb - numericWithdrawalAmount;
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): SERVER-SIDE CHECK PASSED: Deducting ${numericWithdrawalAmount} from ${currentBalanceInDb}. New balance will be ${newBalance}.`);
        return newBalance;
        // --- END OF DETAILED LOGGING ---
      });

      if (!walletUpdateResult.committed) {
        console.warn("WithdrawDialog: Firebase transaction to deduct wallet balance did NOT commit. User:", firebaseUser.uid, "Amount:", withdrawalAmount, "Result:", walletUpdateResult);
        setLocalError(null); 
        toast({ 
          title: "Submission Error", 
          description: "Withdrawal failed. Your actual balance on the server might be too low, or there was a temporary issue. Please refresh your wallet to see the latest balance and try again. If the issue persists, contact support.", 
          variant: "destructive",
          duration: 8000,
        });
        setIsSubmitting(false);
        return;
      }
      console.log("WithdrawDialog: Firebase transaction to deduct wallet balance COMMITTED successfully.");


      const walletTransactionsRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
      const newTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'withdrawal',
        amount: -withdrawalAmount, // Store as negative
        status: 'pending', 
        date: new Date().toISOString(),
        description: 'Withdrawal request (Funds on Hold)',
      };
      const newTransactionRef = await push(walletTransactionsRef, newTransactionData);
      initialTransactionId = newTransactionRef.key;

      if (!initialTransactionId) {
        // Attempt to reverse wallet deduction if logging failed
        console.error("WithdrawDialog: Failed to get key for new transaction log. Attempting to reverse wallet deduction.");
        await runTransaction(userWalletRef, (currentBalance) => (Number(currentBalance || 0)) + withdrawalAmount);
        throw new Error("Failed to log withdrawal transaction. Amount deduction (if any) reversed. Please try again.");
      }
      console.log("WithdrawDialog: Logged 'pending' withdrawal transaction successfully. ID:", initialTransactionId);

      const withdrawalRequestData: Omit<WithdrawRequest, 'id' | 'processedDate' | 'adminNotes'> = {
        uid: firebaseUser.uid,
        username: userProfile.username || firebaseUser.email || 'N/A',
        amount: withdrawalAmount,
        method: method.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        status: "pending",
        requestDate: new Date().toISOString(),
        walletTransactionId: initialTransactionId, 
      };
      const withdrawalRequestsRef = ref(database, 'withdrawRequests');
      await push(withdrawalRequestsRef, withdrawalRequestData);
      console.log("WithdrawDialog: Created withdrawal request in Firebase successfully.");

      toast({
        title: "Withdrawal Request Submitted",
        description: `Rs ${withdrawalAmount.toFixed(2)} has been put on hold from your wallet. Your request will be processed soon.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      handleResetForm();
      onOpenChange(false); 
      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error("WithdrawDialog: Error submitting withdrawal request:", err);
      const dialogErrorMessage = err.message || "Could not submit withdrawal request.";
      let toastDescription = dialogErrorMessage;

      if (String(err.message).toLowerCase().includes('permission_denied')) {
        toastDescription = "Permission Denied. Cannot submit withdrawal. Please check Firebase rules.";
      }
      
      // Avoid setting localError if the toast already covers the common transaction failure scenario
      if (!toastDescription.includes("Your actual balance on the server might be too low")) {
          setLocalError(dialogErrorMessage); 
      }
      
      if (!toastDescription.includes("Your actual balance on the server might be too low")) {
          toast({ title: "Submission Error", description: toastDescription, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  if (!userProfile) { 
    return <p className="text-muted-foreground p-4">User profile not available for withdrawal.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div>
        <Label htmlFor="dialog-amount" className="text-sm font-medium text-foreground">Amount (Rs)</Label>
        <Input
          id="dialog-amount" type="number" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`e.g., ${MIN_WITHDRAWAL_AMOUNT}`}
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
          min={MIN_WITHDRAWAL_AMOUNT.toString()} step="0.01"
        />
        {userProfile && (
          <p className="text-xs text-muted-foreground mt-1">
            Available for withdrawal: Rs {Number(userProfile.wallet || 0).toFixed(2)}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="dialog-method" className="text-sm font-medium text-foreground">Method</Label>
        <Input
          id="dialog-method" type="text" value={method}
          onChange={(e) => setMethod(e.target.value)}
          placeholder="e.g., Easypaisa, Jazzcash, Bank"
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
        />
      </div>
      <div>
        <Label htmlFor="dialog-accountNumber" className="text-sm font-medium text-foreground">Account Number/IBAN</Label>
        <Input
          id="dialog-accountNumber" type="text" value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="Your account number"
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
        />
      </div>
      <div>
        <Label htmlFor="dialog-accountName" className="text-sm font-medium text-foreground">Account Holder Name</Label>
        <Input
          id="dialog-accountName" type="text" value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Full name on account"
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
        />
      </div>

      {localError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      <Alert variant="default" className="bg-primary/10 border-primary/30 mt-4">
          <Info className="h-4 w-4 !text-primary" />
          <AlertTitle className="!text-primary text-sm">Important</AlertTitle>
          <AlertDescription className="!text-primary/80 text-xs">
           Requests are processed within 24-48 hours. Ensure all details are correct.
          </AlertDescription>
      </Alert>
    
      <DialogFooter className="pt-4 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            handleResetForm(); 
            onOpenChange(false); 
          }}
          className="border-muted-foreground/50 text-muted-foreground hover:bg-muted/20"
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" className="neon-accent-bg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit Request
        </Button>
      </DialogFooter>
    </form>
  );
}
