
"use client";

import { useState, FormEvent, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, push, serverTimestamp, runTransaction } from 'firebase/database';
import type { ShopItem, User as AppUserType, WalletTransaction, ShopOrder, Coupon } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';
import { Loader2, Send, X, ShoppingBag, AlertCircle, TicketPercent } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


interface BuyNowDialogProps {
  item: ShopItem;
  coupon: Coupon | null;
  firebaseUser: FirebaseUser | null;
  appUser: AppUserType | null;
  onOpenChange: (open: boolean) => void;
}

interface ShippingFormData {
  fullName: string;
  address: string;
  phone: string;
  city: string;
  postalCode: string;
}

export default function BuyNowDialog({ item, coupon, firebaseUser, appUser, onOpenChange }: BuyNowDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ShippingFormData>({
    fullName: '',
    address: '',
    phone: '',
    city: '',
    postalCode: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const finalPrice = useMemo(() => {
    if (!coupon) return item.price;
    if (coupon.discountType === 'percentage') {
        return item.price * (1 - coupon.discountValue / 100);
    } else {
        return Math.max(0, item.price - coupon.discountValue);
    }
  }, [item.price, coupon]);

  const discountApplied = useMemo(() => {
    return item.price - finalPrice;
  }, [item.price, finalPrice]);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!firebaseUser || !appUser) {
      toast({ title: "Authentication Error", description: "User not logged in.", variant: "destructive" });
      return;
    }

    if (!formData.fullName || !formData.address || !formData.phone || !formData.city || !formData.postalCode) {
      setFormError("All shipping fields are required.");
      return;
    }
    
    if (Number(appUser.wallet) < finalPrice) {
        setFormError("Insufficient wallet balance for this purchase.");
        toast({ title: "Balance Error", description: "Your wallet balance is too low for this item.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);

    try {
      if (!database) throw new Error("Firebase database not initialized");

      const userWalletRef = ref(database, `users/${firebaseUser.uid}/wallet`);
      const walletHoldTransactionRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
      let holdTransactionId: string | null = null;

      const walletTxResult = await runTransaction(userWalletRef, (currentBalance) => {
        const numericBalance = Number(currentBalance || 0);
        if (numericBalance < finalPrice) {
          return; 
        }
        return numericBalance - finalPrice;
      });

      if (!walletTxResult.committed) {
        throw new Error("Could not update wallet balance. Insufficient funds on server or transaction conflict.");
      }
      
      const newHoldTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'shop_purchase_hold',
        amount: -finalPrice,
        status: 'on_hold',
        date: new Date().toISOString(),
        description: `Hold for ${item.name}`,
        relatedProductId: item.id,
      };
      const newHoldTxPushRef = await push(walletHoldTransactionRef, newHoldTransactionData);
      holdTransactionId = newHoldTxPushRef.key;

      if (!holdTransactionId) {
        await runTransaction(userWalletRef, (currentBalance) => (Number(currentBalance || 0)) + finalPrice);
        throw new Error("Failed to log hold transaction. Wallet deduction (if any) reversed.");
      }

      const purchaseRequestsRef = ref(database, 'purchaseRequests');
      const newOrderData: Omit<ShopOrder, 'id'> = {
        userId: firebaseUser.uid,
        username: appUser.username || firebaseUser.email || 'N/A',
        productId: item.id,
        productName: item.name,
        productPrice: finalPrice,
        shippingDetails: formData,
        orderTimestamp: serverTimestamp(),
        status: 'pending_fulfillment',
        walletHoldTransactionId: holdTransactionId,
        couponUsed: coupon ? coupon.code : null,
        discountApplied: discountApplied > 0 ? discountApplied : null,
      };
      await push(purchaseRequestsRef, newOrderData);

      toast({
        title: "Purchase Successful!",
        description: `${item.name} ordered. Rs ${finalPrice.toFixed(2)} deducted.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
        duration: 7000,
      });
      onOpenChange(false);

    } catch (error: any) {
      console.error("Error processing purchase:", error);
      setFormError(error.message || "An unexpected error occurred during purchase.");
      toast({ title: "Purchase Failed", description: error.message || "Could not complete your purchase.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl text-accent flex items-center">
          <ShoppingBag className="mr-2 h-6 w-6" /> Purchase: {item.name}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Enter your shipping details.
        </DialogDescription>
        {coupon && (
            <div className="text-sm text-green-400 font-semibold flex items-center gap-2 pt-2">
                <TicketPercent className="h-4 w-4" />
                <span>Coupon "{coupon.code}" applied! You saved <RupeeIcon className="inline h-3.5"/>{discountApplied.toFixed(2)}.</span>
            </div>
        )}
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Your Full Name" required className="bg-input/50 border-border/70 focus:border-accent" />
        </div>
        <div>
          <Label htmlFor="address">Full Home Address</Label>
          <Textarea id="address" name="address" value={formData.address} onChange={handleInputChange} placeholder="Street, House No., Landmark, etc." required className="bg-input/50 border-border/70 focus:border-accent" />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="Your Contact Number" required className="bg-input/50 border-border/70 focus:border-accent" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" value={formData.city} onChange={handleInputChange} placeholder="Your City" required className="bg-input/50 border-border/70 focus:border-accent" />
          </div>
          <div>
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input id="postalCode" name="postalCode" value={formData.postalCode} onChange={handleInputChange} placeholder="City Postal Code" required className="bg-input/50 border-border/70 focus:border-accent" />
          </div>
        </div>

        {formError && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
            </Alert>
        )}

        <Alert variant="default" className="bg-primary/10 border-primary/30">
            <AlertCircle className="h-4 w-4 !text-primary" />
            <AlertTitle className="!text-primary">Payment Note</AlertTitle>
            <AlertDescription className="!text-primary/80 text-xs">
              Final Amount: <RupeeIcon className="inline h-3" />{finalPrice.toFixed(2)}. 
              Available Balance: <RupeeIcon className="inline h-3" />{appUser?.wallet.toFixed(2) ?? '0.00'}
            </AlertDescription>
        </Alert>

        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="border-muted-foreground text-muted-foreground hover:bg-muted/20" disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </DialogClose>
          <Button type="submit" className="neon-accent-bg" disabled={isSubmitting || (Number(appUser?.wallet ?? 0) < finalPrice)}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSubmitting ? "Processing..." : "Confirm & Pay"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
    
