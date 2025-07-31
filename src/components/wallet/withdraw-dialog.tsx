
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, X, Info, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { database } from '@/lib/firebase/config';
import { ref, push, runTransaction, get, update, serverTimestamp } from 'firebase/database';
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
      setLocalError("You must be logged in to request a mobile load.");
      return;
    }

    const withdrawalAmount = parseFloat(amount);
    const userWalletBalance = Number(userProfile.wallet || 0);

    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      setLocalError("Please enter a valid amount to withdraw.");
      return;
    }
    if (withdrawalAmount < MIN_WITHDRAWAL_AMOUNT) {
      setLocalError(`Minimum withdrawal amount is Rs ${MIN_WITHDRAWAL_AMOUNT}.`);
      return;
    }
    if (withdrawalAmount > userWalletBalance) {
      setLocalError("Withdrawal amount cannot exceed your wallet balance.");
      return;
    }
    if (!method.trim() || !accountNumber.trim() || !accountName.trim()) {
      setLocalError("Please fill all payment detail fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!database) throw new Error("Firebase database not initialized");

      const userWalletRef = ref(database, `users/${firebaseUser.uid}/wallet`);
      
      const txResult = await runTransaction(userWalletRef, (currentBalance) => {
        const numericBalance = Number(currentBalance || 0);
        if (numericBalance < withdrawalAmount) return; // Abort
        return numericBalance - withdrawalAmount;
      });

      if (!txResult.committed) {
        throw new Error("Could not update wallet balance. Insufficient funds on server or transaction conflict.");
      }
      
      const walletTxRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
      const newTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'shop_purchase_hold', // Reusing this type for hold logic
        amount: -withdrawalAmount,
        status: 'on_hold',
        date: new Date().toISOString(),
        description: `Hold for Withdrawal Request to ${method}`,
      };
      const holdTransaction = await push(walletTxRef, newTransactionData);

      if (!holdTransaction.key) {
        // Rollback wallet deduction if logging hold tx fails
        await runTransaction(userWalletRef, (currentBalance) => (Number(currentBalance || 0)) + withdrawalAmount);
        throw new Error("Failed to log hold transaction. Wallet deduction reversed.");
      }

      const mobileLoadRequestsRef = ref(database, 'withdrawRequests'); // Correct path
      const newRequestData: Omit<WithdrawRequest, 'id'> = {
        uid: firebaseUser.uid,
        username: userProfile.username || 'N/A',
        amount: withdrawalAmount, // Submit the full amount, admin will handle fees
        method,
        accountNumber,
        accountName,
        status: "pending",
        requestDate: new Date().toISOString(),
        walletTransactionId: holdTransaction.key,
      };
      await push(mobileLoadRequestsRef, newRequestData);

      toast({
        title: "Withdrawal Request Submitted",
        description: `Your request for Rs ${withdrawalAmount.toFixed(2)} has been sent for processing.`,
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();

    } catch (error: any) {
      setLocalError(error.message || "An unexpected error occurred.");
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (!userProfile) return <p className="p-4 text-muted-foreground">User profile not available.</p>;

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
        
        {userProfile.referredByDelegate && (
             <Alert variant="default" className="bg-primary/10 border-primary/30">
                <Info className="h-4 w-4 !text-primary" />
                <AlertDescription className="!text-primary/80 text-xs">
                    A 5% processing fee will be deducted from the withdrawal amount.
                </AlertDescription>
            </Alert>
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
