
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, X, Info, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { database } from '@/lib/firebase/config';
import { ref, push, runTransaction } from 'firebase/database';
import type { MobileLoadRequest, User as AppUserType, WalletTransaction } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import RupeeIcon from '@/components/core/rupee-icon';
import { ScrollArea } from '../ui/scroll-area';

const MIN_LOAD_AMOUNT = 50;
const PAKISTANI_NETWORKS = ["Jazz", "Telenor", "Zong", "Ufone", "Other"];

interface MobileLoadDialogProps {
  firebaseUser: FirebaseUser | null;
  userProfile: AppUserType | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function MobileLoadDialog({ firebaseUser, userProfile, onOpenChange, onSuccess }: MobileLoadDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.phone) {
      setPhoneNumber(userProfile.phone);
    }
  }, [userProfile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!firebaseUser || !userProfile) {
      setLocalError("You must be logged in to request a mobile load.");
      return;
    }

    const loadAmount = parseFloat(amount);
    const userWalletBalance = Number(userProfile.wallet || 0);

    if (isNaN(loadAmount) || loadAmount < MIN_LOAD_AMOUNT) {
      setLocalError(`Minimum mobile load amount is Rs ${MIN_LOAD_AMOUNT}.`);
      return;
    }
    if (loadAmount > userWalletBalance) {
      setLocalError("Load amount cannot exceed your wallet balance.");
      return;
    }
    if (!network) {
      setLocalError("Please select a mobile network.");
      return;
    }
    if (!/^(03|\+923)\d{9}$/.test(phoneNumber)) {
      setLocalError("Please enter a valid Pakistani phone number (e.g., 03xxxxxxxxx or +923xxxxxxxxx).");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!database) throw new Error("Firebase database not initialized");

      const userWalletRef = ref(database, `users/${firebaseUser.uid}/wallet`);
      
      const txResult = await runTransaction(userWalletRef, (currentBalance) => {
        const numericBalance = Number(currentBalance || 0);
        if (numericBalance < loadAmount) return; // Abort
        return numericBalance - loadAmount;
      });

      if (!txResult.committed) {
        throw new Error("Could not update wallet balance. Insufficient funds on server or transaction conflict.");
      }

      const walletTxRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
      const newTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'shop_purchase_hold', // Reusing this type for hold logic
        amount: -loadAmount,
        status: 'on_hold',
        date: new Date().toISOString(),
        description: `Hold for Mobile Load to ${phoneNumber}`,
      };
      const holdTransaction = await push(walletTxRef, newTransactionData);

      if (!holdTransaction.key) {
        await runTransaction(userWalletRef, (currentBalance) => (Number(currentBalance || 0)) + loadAmount);
        throw new Error("Failed to log hold transaction. Wallet deduction reversed.");
      }

      const mobileLoadRequestsRef = ref(database, 'mobileLoadRequests');
      const newRequestData: Omit<MobileLoadRequest, 'id'> = {
        uid: firebaseUser.uid,
        username: userProfile.username || 'N/A',
        amount: loadAmount,
        network,
        phoneNumber,
        status: "pending",
        requestDate: new Date().toISOString(),
        walletTransactionId: holdTransaction.key,
      };
      await push(mobileLoadRequestsRef, newRequestData);

      toast({
        title: "Mobile Load Request Submitted",
        description: `Your request for a load of Rs ${loadAmount.toFixed(2)} has been sent for processing.`,
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

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl text-accent flex items-center justify-center">
          <Smartphone className="mr-2 h-6 w-6" /> Request Mobile Load
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-center">
          Use your wallet balance to request an Easyload.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[70vh]">
        <form onSubmit={handleSubmit} className="space-y-4 py-4 pr-4">
          <div>
            <Label htmlFor="phone-number">Phone Number</Label>
            <Input id="phone-number" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="03xxxxxxxxx" className="bg-input/50"/>
          </div>
          <div>
            <Label htmlFor="network-select">Network</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger id="network-select" className="bg-input/50">
                <SelectValue placeholder="Select Network" />
              </SelectTrigger>
              <SelectContent className="glass-card">
                {PAKISTANI_NETWORKS.map(net => <SelectItem key={net} value={net}>{net}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="load-amount">Amount (PKR)</Label>
            <Input id="load-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`e.g., ${MIN_LOAD_AMOUNT}`} className="bg-input/50" min={MIN_LOAD_AMOUNT}/>
            <p className="text-xs text-muted-foreground mt-1">Available Balance: <RupeeIcon className="inline h-3.5"/> {userProfile.wallet.toFixed(2)}</p>
          </div>

          {localError && (
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{localError}</AlertDescription></Alert>
          )}

          <Alert variant="default" className="bg-primary/10 border-primary/30">
            <Info className="h-4 w-4 !text-primary" /><AlertDescription className="!text-primary/80 text-xs">Requests are processed by admin. Ensure details are correct. Funds will be put on hold.</AlertDescription>
          </Alert>
      
          <DialogFooter className="pt-4 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-muted-foreground text-muted-foreground" disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" className="neon-accent-bg" disabled={isSubmitting || parseFloat(amount) > userProfile.wallet}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </ScrollArea>
    </>
  );
}
