
"use client";

import { useState, useCallback } from 'react';
import type { User, WalletTransaction, RedeemCodeEntry, GlobalSettings } from '@/types';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Download, ArrowRightLeft, Award as AwardIcon, Gift as GiftIcon, Users as UsersIcon, Banknote, CreditCard, Ticket, Loader2, Zap, Smartphone, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RupeeIcon from '@/components/core/rupee-icon';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { database, auth } from '@/lib/firebase/config'; 
import { ref, update, push, runTransaction } from 'firebase/database';
import type { User as FirebaseUser } from 'firebase/auth'; 
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import WithdrawDialog from './withdraw-dialog';
import MobileLoadDialog from './mobile-load-dialog';
import { useAd } from '@/context/AdContext';
import { Separator } from '../ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, formatDistanceToNow, parseISO } from 'date-fns';


interface WalletDisplayProps {
  user: User;
  transactions: WalletTransaction[];
  firebaseUser: FirebaseUser | null;
  settings: Partial<GlobalSettings>;
  onRefresh: () => void;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ user, transactions, firebaseUser, settings, onRefresh }) => {
  const { toast } = useToast();
  const { triggerButtonAd } = useAd();
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isMobileLoadDialogOpen, setIsMobileLoadDialogOpen] = useState(false);
  const [isRechargeLoading, setIsRechargeLoading] = useState(false);
  

  const getTransactionTypeIcon = (type: WalletTransaction['type']) => {
    const iconClass = "w-6 h-6 shrink-0";
    switch (type) {
      case 'topup': return <PlusCircle className={`text-green-500 ${iconClass}`} />;
      case 'withdrawal': return <Download className={`text-red-500 ${iconClass}`} />;
      case 'entry_fee': return <Banknote className={`text-yellow-600 ${iconClass}`} />;
      case 'prize': return <AwardIcon className={`text-blue-500 ${iconClass}`} />;
      case 'redeem_code': return <Ticket className={`text-purple-500 ${iconClass}`} />;
      case 'referral_bonus_received': return <GiftIcon className={`text-pink-500 ${iconClass}`} />;
      case 'referral_commission_earned': return <UsersIcon className={`text-indigo-500 ${iconClass}`} />;
      case 'refund': return <AwardIcon className={`text-cyan-500 ${iconClass}`} />;
      case 'shop_purchase_hold': return <CreditCard className={`text-gray-500 ${iconClass}`} />;
      case 'shop_purchase_complete': return <CreditCard className={`text-green-500 ${iconClass}`} />;
      case 'watch_earn_conversion': return <Zap className={`text-yellow-400 ${iconClass}`} />;
      default: return <ArrowRightLeft className={`text-muted-foreground ${iconClass}`} />;
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleRedeemCode = async () => {
    if (!redeemCodeInput.trim() || !firebaseUser || !database) {
      toast({ title: "Input Error", description: "Please enter a redeem code and ensure you're logged in.", variant: "destructive" });
      return;
    }

    setIsRedeeming(true);
    const codeString = redeemCodeInput.trim().toUpperCase();

    try {
      const codeRef = ref(database, `redeemCodes/${codeString}`);
      
      const transactionResult = await runTransaction(codeRef, (codeData: RedeemCodeEntry | null) => {
        if (codeData === null) return; // Code does not exist
        if (codeData.timesUsed >= codeData.maxUses) return; // Code is fully used
        if (codeData.claimedBy && codeData.claimedBy[firebaseUser.uid]) return; // User already claimed
        
        codeData.timesUsed = (codeData.timesUsed || 0) + 1;
        if (!codeData.claimedBy) codeData.claimedBy = {};
        codeData.claimedBy[firebaseUser.uid] = new Date().toISOString();
        if(codeData.timesUsed >= codeData.maxUses) codeData.isUsed = true;
        
        return codeData;
      });

      if (!transactionResult.committed) {
         throw new Error("This code is invalid, already used, or has reached its limit.");
      }

      const codeData = transactionResult.snapshot.val() as RedeemCodeEntry;
      const userWalletRef = ref(database, `users/${firebaseUser.uid}/wallet`);
      await runTransaction(userWalletRef, (currentBalance) => (currentBalance || 0) + codeData.amount);

      const newTransaction: Omit<WalletTransaction, 'id'> = {
        type: 'redeem_code', amount: codeData.amount, status: 'completed',
        date: new Date().toISOString(), description: `Redeemed code: ${codeString}`,
      };
      await push(ref(database, `walletTransactions/${firebaseUser.uid}`), newTransaction);

      toast({ title: "Code Redeemed!", description: `Rs ${codeData.amount} added to your wallet.`, className: "bg-green-500/20 text-green-300 border-green-500/30" });
      setRedeemCodeInput('');
      onRefresh();
    } catch (error) {
      toast({ title: "Redemption Error", description: `Could not redeem code: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };
  
  const handleRechargeClick = async () => {
    setIsRechargeLoading(true);
    
    try {
        if (!user) throw new Error("User not available.");

        const response = await fetch('/api/get-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: user.appliedReferralCode }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to get contact information.');
        }

        const { contactNumber } = await response.json();
        const cleanedNumber = contactNumber.replace(/\D/g, '');

        const timeSinceRegistration = user.createdAt ? formatDistanceToNow(parseISO(user.createdAt), { addSuffix: true }) : 'N/A';
        const rechargeMessage = `Assalamualaikum, Admin!

I need to top-up my Arena Ace wallet. Here are my details:
-----------------------------------
*Username:* ${user.username || 'N/A'}
*User ID:* ${user.id || 'N/A'}
*Referred By Code:* ${user.appliedReferralCode || 'N/A'}
*Member Since:* ${timeSinceRegistration}
-----------------------------------

Please guide me on the payment process. Thank you!`.trim();

        const url = `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(rechargeMessage)}`;
        window.open(url, '_blank', 'noopener,noreferrer');

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsRechargeLoading(false);
    }
  };
  
  const isMobileLoadEnabled = settings?.mobileLoadEnabled === true;
  const canRecharge = settings?.contactWhatsapp && settings.contactWhatsapp.length > 0;

  return (
    <div className="space-y-8">
      <GlassCard className="p-6 md:p-8 shadow-xl border-2 border-accent/30 hover:shadow-accent/50 transition-shadow duration-300">
        <div className="flex flex-col items-center text-center mb-6">
          <p className="text-base sm:text-lg text-muted-foreground mb-1">Your Arena Balance</p>
          <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-accent flex items-center neon-accent-text">
            <RupeeIcon className="mr-2 h-10 sm:h-12 w-auto" /> {user.wallet.toFixed(2)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button className="bg-green-500 hover:bg-green-600 text-white text-base py-2 sm:py-3 shadow-lg hover:shadow-green-500/50 transition-shadow col-span-1" onClick={handleRechargeClick} disabled={!canRecharge || isRechargeLoading}>
             {isRechargeLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <PlusCircle className="mr-2 h-5 w-5" />}
              Contact for Top-up
              {!canRecharge && <span className="ml-2 text-xs opacity-70">(N/A)</span>}
          </Button>

          {isMobileLoadEnabled && (
            <Dialog open={isMobileLoadDialogOpen} onOpenChange={setIsMobileLoadDialogOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 text-base py-2 sm:py-3 shadow-lg hover:shadow-accent/30 transition-shadow col-span-1">
                      <Smartphone className="mr-2 h-5 w-5" /> Mobile Load
                  </Button>
              </DialogTrigger>
              <DialogContent className="glass-card sm:max-w-md">
                  <MobileLoadDialog
                      firebaseUser={firebaseUser}
                      userProfile={user}
                      onOpenChange={setIsMobileLoadDialogOpen}
                      onSuccess={onRefresh}
                  />
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 text-base py-2 sm:py-3 shadow-lg hover:shadow-accent/30 transition-shadow col-span-1" onClick={() => triggerButtonAd(() => setIsWithdrawDialogOpen(true), 'wallet_withdraw')}>
                <Download className="mr-2 h-5 w-5" /> Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card sm:max-w-md">
              <WithdrawDialog 
                firebaseUser={firebaseUser} 
                userProfile={user} 
                onOpenChange={setIsWithdrawDialogOpen}
                onSuccess={onRefresh}
                settings={settings}
              />
            </DialogContent>
          </Dialog>
        </div>
      </GlassCard>

      <GlassCard className="p-6 md:p-8 shadow-xl">
        <div className="space-y-4 text-center md:text-left">
             <h3 className="text-2xl font-semibold text-foreground flex items-center justify-center sm:justify-start">
                <GiftIcon className="mr-3 h-7 w-7 text-accent" /> Redeem Gift Code
            </h3>
            <p className="text-sm text-muted-foreground">
                Enter your gift code below to instantly add funds to your wallet.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative flex-grow w-full">
                    <Ticket className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="redeemCodeInput" placeholder="Enter code" className="pl-10 pr-4 py-3 bg-input/50" value={redeemCodeInput} onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())} disabled={isRedeeming} />
                </div>
                <Button className="neon-accent-bg w-full sm:w-auto" onClick={handleRedeemCode} disabled={isRedeeming || !redeemCodeInput}>
                    {isRedeeming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Redeem'}
                </Button>
            </div>
        </div>
      </GlassCard>
      
      <GlassCard className="p-0 shadow-xl">
        <div className="p-6 border-b border-border/30 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-semibold text-foreground">Transaction History</h3>
            <p className="text-sm text-muted-foreground mt-1">View all your recent wallet activities.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="text-accent border-accent hover:bg-accent/10">
            <Loader2 className="mr-2 h-4 w-4 animate-spin hidden" id="refresh-spinner" /> Refresh
          </Button>
        </div>
        {sortedTransactions.length > 0 ? (
          <ScrollArea className="h-[600px] w-full">
            <ul className="divide-y divide-border/30">
              {sortedTransactions.map((tx) => (
                <li key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    {getTransactionTypeIcon(tx.type)}
                    <div>
                      <p className="font-medium text-sm text-foreground">{tx.description || tx.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-md ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : '-'}<RupeeIcon className="inline h-3.5 w-auto mr-0.5" />{Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' || tx.status === 'on_hold' ? 'secondary' : 'destructive'} className="mt-1 text-xs capitalize">
                      {tx.status?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="p-6 text-center text-muted-foreground py-16"> 
            <CreditCard className="mx-auto h-16 w-16 text-muted-foreground/40 mb-6" />
            <p className="text-xl font-semibold text-foreground mb-1">No Transactions Yet</p>
            <p className="text-sm">Your wallet activity will appear here once you make any transactions.</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default WalletDisplay;
