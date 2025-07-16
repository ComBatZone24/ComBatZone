
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, X, Info, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { database } from '@/lib/firebase/config';
import { ref, push, runTransaction } from 'firebase/database';
import type { WithdrawRequest, User as AppUserType, WalletTransaction, GlobalSettings } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import RupeeIcon from '@/components/core/rupee-icon';

const MIN_WITHDRAWAL_AMOUNT = 300;

interface WithdrawDialogProps {
  firebaseUser: FirebaseUser | null;
  userProfile: AppUserType | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  settings: Partial<GlobalSettings>;
}

export default function WithdrawDialog({ firebaseUser, userProfile, onOpenChange, onSuccess, settings }: WithdrawDialogProps) {
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

    const withdrawalAmount = parseFloat(amount);
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
        
        const currentBalanceInDb = Number(currentBalance || 0);
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Parsed numeric currentBalanceInDb: ${currentBalanceInDb}`);
        
        const numericWithdrawalAmount = Number(withdrawalAmount);
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): Numeric withdrawalAmount to check: ${numericWithdrawalAmount}`);

        if (currentBalance === null) {
            console.warn(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): User wallet node is null/missing in Firebase. Treating as 0.`);
        }

        if (currentBalanceInDb < numericWithdrawalAmount) {
          console.warn(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): SERVER-SIDE CHECK FAILED: Aborting transaction. Server balance (${currentBalanceInDb}) is less than withdrawal amount (${numericWithdrawalAmount}).`);
          return;
        }
        
        const newBalance = currentBalanceInDb - numericWithdrawalAmount;
        console.log(`WithdrawDialog (Firebase Tx - ${firebaseUser.uid}): SERVER-SIDE CHECK PASSED: Deducting ${numericWithdrawalAmount} from ${currentBalanceInDb}. New balance will be ${newBalance}.`);
        return newBalance;
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
        amount: -withdrawalAmount,
        status: 'pending', 
        date: new Date().toISOString(),
        description: 'Withdrawal request (Funds on Hold)',
      };
      const newTransactionRef = await push(walletTransactionsRef, newTransactionData);
      initialTransactionId = newTransactionRef.key;

      if (!initialTransactionId) {
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

  if (!userProfile) return <p className="p-4 text-muted-foreground">User profile not available for withdrawal.</p>;

  const withdrawMessage = `Hi, I need help with my withdrawal request. My User ID is: ${userProfile.id || 'N/A'}`;
  const withdrawWhatsappUrl = `${settings.contactWhatsapp}?text=${encodeURIComponent(withdrawMessage)}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl text-accent">Request Withdrawal</DialogTitle>
        <DialogDescription>
          Enter your payment details. Funds will be sent after admin approval.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        <div>
          <Label htmlFor="dialog-amount">Amount (PKR)</Label>
          <Input
            id="dialog-amount" type="number" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`e.g., ${MIN_WITHDRAWAL_AMOUNT}`}
            className="mt-1 bg-input/50"
            min={MIN_WITHDRAWAL_AMOUNT.toString()} step="0.01"
          />
          <p className="text-xs text-muted-foreground mt-1">Available for withdrawal: Rs {Number(userProfile.wallet || 0).toFixed(2)}</p>
        </div>
        <div>
          <Label htmlFor="dialog-method">Method</Label>
          <Input
            id="dialog-method" type="text" value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="e.g., Easypaisa, Jazzcash, Bank"
            className="mt-1 bg-input/50"
          />
        </div>
        <div>
          <Label htmlFor="dialog-accountNumber">Account Number/IBAN</Label>
          <Input
            id="dialog-accountNumber" type="text" value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Your account number"
            className="mt-1 bg-input/50"
          />
        </div>
        <div>
          <Label htmlFor="dialog-accountName">Account Holder Name</Label>
          <Input
            id="dialog-accountName" type="text" value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Full name on account"
            className="mt-1 bg-input/50"
          />
        </div>

        {localError && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{localError}</AlertDescription></Alert>
        )}

        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <Info className="h-4 w-4 !text-primary" /><AlertDescription className="!text-primary/80 text-xs">Requests are processed within 24-48 hours. Funds will be held from your wallet upon submission. For issues, contact admin.</AlertDescription>
        </Alert>
        
        {settings.contactWhatsapp && (
          <Button variant="outline" className="w-full" asChild>
            <a href={withdrawWhatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageSquare className="mr-2 h-4 w-4" /> Contact Admin on WhatsApp
            </a>
          </Button>
        )}
    
        <DialogFooter className="pt-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => { handleResetForm(); onOpenChange(false); }}
            className="border-muted-foreground/50 text-muted-foreground"
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" className="neon-accent-bg" disabled={isSubmitting || parseFloat(amount) > userProfile.wallet}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Request
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
