
"use client";

import { useState, FormEvent, useEffect, useCallback } from 'react';
import type { User, WalletTransaction, RedeemCodeEntry, GlobalSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Wallet as WalletIcon, Gift, Smartphone, ArrowRight, X, CreditCard, Send, Ticket, MessageSquare } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo, runTransaction, push, update } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import WithdrawDialog from './withdraw-dialog';
import MobileLoadDialog from './mobile-load-dialog';
import type { User as FirebaseUser } from 'firebase/auth';
import GlassCard from '@/components/core/glass-card';
import { useAuth } from '@/context/AuthContext';


interface WalletDisplayProps {
  user: User;
  firebaseUser: FirebaseUser | null;
  transactions: WalletTransaction[];
  settings: Partial<GlobalSettings>;
  onRefresh: () => void;
  isLoading?: boolean; // Added isLoading prop
}

const TransactionRow: React.FC<{ transaction: WalletTransaction }> = ({ transaction }) => {
    const getTransactionIcon = (type: WalletTransaction['type']) => {
        switch (type) {
            case 'topup': return <CreditCard className="h-4 w-4 text-blue-400" />;
            case 'prize': return <Gift className="h-4 w-4 text-yellow-400" />;
            case 'redeem_code': return <Ticket className="h-4 w-4 text-green-400" />;
            case 'referral_bonus_received':
            case 'referral_commission_earned':
            case 'daily_login_reward':
            case 'cpa_grip_reward':
                 return <Gift className="h-4 w-4 text-yellow-400" />;
            default: return <WalletIcon className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <TableRow key={transaction.id} className="border-b-border/20">
            <TableCell className="p-2 sm:p-3">
            <div className="flex items-center gap-3">
                <div className="bg-muted/30 p-2 rounded-md">
                    {getTransactionIcon(transaction.type)}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground capitalize">{(transaction.type || '-').replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">{transaction.description || 'No details'}</span>
                </div>
            </div>
            </TableCell>
            <TableCell className="p-2 sm:p-3 text-right">
            <div className={`font-semibold flex items-center justify-end ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {transaction.amount >= 0 ? '+' : '-'}<RupeeIcon className="inline h-3.5"/>{Math.abs(transaction.amount).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(transaction.date).toLocaleDateString()}</div>
            </TableCell>
        </TableRow>
    );
};

export default function WalletDisplay({ user, firebaseUser, transactions, settings, onRefresh, isLoading = false }: WalletDisplayProps) {
  const { toast } = useToast();
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  const [activeDialog, setActiveDialog] = useState<'withdraw' | 'mobile_load' | 'topup_info' | null>(null);

  const handleRedeemCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!redeemCode.trim()) {
      toast({ title: "Input Invalid", description: "Please enter a redeem code.", variant: "destructive" });
      return;
    }
    
    if (!user || !user.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to redeem a code.", variant: "destructive" });
        return;
    }

    setIsRedeeming(true);
    
    try {
      if (!database) throw new Error("Firebase database is not initialized");
      
      const codeRef = ref(database, `redeemCodes/${redeemCode.toUpperCase()}`);
      const codeSnapshot = await get(codeRef);

      if (!codeSnapshot.exists()) {
        throw new Error("Invalid or expired redeem code.");
      }

      const codeData = codeSnapshot.val() as RedeemCodeEntry;
      
      if ((codeData.timesUsed || 0) >= codeData.maxUses) {
         throw new Error("This redeem code has reached its maximum usage limit.");
      }
      if (codeData.claimedBy && codeData.claimedBy[user.id]) {
        throw new Error("You have already used this redeem code.");
      }
      
      const userWalletRef = ref(database, `users/${user.id}/wallet`);
      const transactionResult = await runTransaction(userWalletRef, (currentBalance) => {
        return (currentBalance || 0) + codeData.amount;
      });

      if (!transactionResult.committed) {
         throw new Error("Failed to update wallet. Please try again.");
      }

      const updates: Record<string, any> = {};
      updates[`redeemCodes/${redeemCode.toUpperCase()}/timesUsed`] = (codeData.timesUsed || 0) + 1;
      updates[`redeemCodes/${redeemCode.toUpperCase()}/claimedBy/${user.id}`] = new Date().toISOString();
      await update(ref(database), updates);

      const walletTxRef = ref(database, `walletTransactions/${user.id}`);
      const newTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'redeem_code',
        amount: codeData.amount,
        status: 'completed',
        date: new Date().toISOString(),
        description: `Redeemed code: ${redeemCode.toUpperCase()}`,
      };
      await push(walletTxRef, newTransactionData);

      toast({
        title: "Code Redeemed!",
        description: `Rs ${codeData.amount.toFixed(2)} has been added to your wallet.`,
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      setRedeemCode('');
      onRefresh(); // Trigger a refresh of user data from the parent

    } catch (error: any) {
      toast({ title: "Redemption Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };
  
  const topupWhatsappUrl = settings.contactWhatsapp && settings.contactWhatsapp.length > 0 ? `${settings.contactWhatsapp[0]}` : '#';

  return (
    isLoading ? (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="mt-4 text-muted-foreground">Loading wallet data...</p>
      </div>
    ) : (
    <div className="space-y-8">
      <GlassCard className="p-6 md:p-8 text-center">
        <p className="text-muted-foreground mb-1">Current Wallet Balance</p>
        <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 flex items-center justify-center neon-accent-text">
            <RupeeIcon className="inline h-12 -mt-2"/> 
            {(user.wallet || 0).toFixed(2)}
        </h2>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
           <Button variant="outline" className="flex-grow sm:flex-grow-0 border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground" onClick={() => setActiveDialog('withdraw')}>
              Withdraw Funds
           </Button>
          {settings.mobileLoadEnabled && (
             <Button variant="outline" className="flex-grow sm:flex-grow-0 border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground" onClick={() => setActiveDialog('mobile_load')}>
                <Smartphone className="mr-2 h-4 w-4"/>Mobile Load
             </Button>
          )}
           <Button variant="default" className="flex-grow sm:flex-grow-0 neon-accent-bg" onClick={() => setActiveDialog('topup_info')}>
                <MessageSquare className="mr-2 h-4 w-4"/>How to Topup?
           </Button>
        </div>
      </GlassCard>

      <Dialog open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="glass-card sm:max-w-md">
          {activeDialog === 'withdraw' && (
            <WithdrawDialog 
              onOpenChange={(open) => !open && setActiveDialog(null)}
              onSuccess={onRefresh}
              settings={settings}
            />
          )}
           {activeDialog === 'mobile_load' && (
            <MobileLoadDialog 
              userProfile={user}
              firebaseUser={firebaseUser}
              onOpenChange={(open) => !open && setActiveDialog(null)}
              onSuccess={onRefresh}
            />
          )}
           {activeDialog === 'topup_info' && (
            <>
              <DialogHeader>
                  <DialogTitle className="text-xl text-accent">How to Topup?</DialogTitle>
                  <DialogDescription>Contact admin via WhatsApp to add funds to your wallet.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <p className="text-sm text-muted-foreground">Please contact the administrator on WhatsApp to request a top-up. They will provide you with payment details and credit your account upon confirmation.</p>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
                  <Button asChild className="neon-accent-bg"><a href={topupWhatsappUrl} target="_blank" rel="noopener noreferrer"><MessageSquare className="mr-2 h-4 w-4"/> Contact Admin</a></Button>
              </DialogFooter>
            </>
           )}
        </DialogContent>
      </Dialog>


       <GlassCard className="p-6 md:p-8">
        <h3 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2"><Gift className="h-5 w-5 text-accent"/> Redeem Gift Code</h3>
        <p className="text-sm text-muted-foreground mb-4">Enter a gift code provided by the administrator to redeem your reward.</p>
         <form onSubmit={handleRedeemCode} className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  id="redeemCodeInput" 
                  placeholder="Enter Code" 
                  className="pl-10 pr-4 py-3 bg-input/50" 
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              />
            </div>
            <Button type="submit" className="neon-accent-bg" disabled={isRedeeming}>
              {isRedeeming ? <Loader2 className="animate-spin" /> : "Redeem"}
            </Button>
          </form>
       </GlassCard>

      <GlassCard className="p-0">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-xl font-semibold">Transaction History</h3>
        </div>
        {transactions.length > 0 ? (
          <ScrollArea className="h-96">
            <Table>
              <TableBody>
                {transactions.map(tx => <TransactionRow key={tx.id} transaction={tx} />)}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground p-10">No transactions yet.</p>
        )}
      </GlassCard>
    </div>
    )
  );
}
