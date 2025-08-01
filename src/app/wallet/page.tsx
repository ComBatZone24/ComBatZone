
"use client";

import { useEffect, useState, useCallback } from 'react';
import WalletDisplay from '@/components/wallet/wallet-display';
import type { User, WalletTransaction, GlobalSettings } from '@/types';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { database, auth } from '@/lib/firebase/config';
import { ref, onValue, get, update, query, orderByChild, equalTo, runTransaction, push } from 'firebase/database';
import type { User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/core/glass-card';
import { Coins } from 'lucide-react';
import Image from 'next/image';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import { mockGlobalSettings } from '@/lib/mock-data';
import { useAuth } from '@/context/AuthContext';
import AdSenseDisplayAd from '@/components/ads/AdSenseDisplayAd';


export default function WalletPage() {
  const { user: appUser, authUser, loading: isAuthLoading, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const applyReferralBonusIfNeeded = useCallback(async () => {
    if (!authUser || !database || !appUser || !appUser.id) return;

    // Check if the user has applied a code but not yet received the bonus.
    if (appUser.appliedReferralCode && !appUser.referralBonusReceived) {
        const bonusAmount = globalSettings?.referralBonusAmount || 0;
        if (!globalSettings?.shareAndEarnEnabled || bonusAmount <= 0) return;

        console.log(`Applying referral bonus for user ${appUser.id} with code ${appUser.appliedReferralCode}`);

        try {
            const usersRef = ref(database, 'users');
            const referrerQuery = query(usersRef, orderByChild('referralCode'), equalTo(appUser.appliedReferralCode));
            const referrerSnapshot = await get(referrerQuery);

            if (referrerSnapshot.exists()) {
                let referrerId = '';
                let referrerData: User | null = null;
                referrerSnapshot.forEach(child => {
                    referrerId = child.key!;
                    referrerData = child.val();
                });

                if (referrerId && referrerId !== appUser.id) {
                    // Credit the referrer
                    const referrerWalletRef = ref(database, `users/${referrerId}/wallet`);
                    const referrerCommissionsRef = ref(database, `users/${referrerId}/totalReferralCommissionsEarned`);
                    await runTransaction(referrerWalletRef, balance => (balance || 0) + bonusAmount);
                    await runTransaction(referrerCommissionsRef, balance => (balance || 0) + bonusAmount);
                    
                    // Log transaction for referrer
                    await push(ref(database, `walletTransactions/${referrerId}`), {
                        type: 'referral_commission_earned',
                        amount: bonusAmount,
                        status: 'completed',
                        date: new Date().toISOString(),
                        description: `Commission for referring ${appUser.username}`,
                    });

                    // Update the new user's record to show bonus was received
                    // This prevents the bonus from being applied multiple times
                    await update(ref(database, `users/${appUser.id}`), {
                      referralBonusReceived: bonusAmount,
                      // We don't add to the wallet here as it was done during signup.
                    });

                    toast({ title: "Referrer Rewarded!", description: `Your referrer ${referrerData?.username || ''} also received Rs ${bonusAmount}.`, className: "bg-green-500/20" });
                    onRefresh();
                }
            } else {
                // Mark the code as invalid if no referrer is found
                await update(ref(database, `users/${appUser.id}`), { appliedReferralCode: `${appUser.appliedReferralCode}_INVALID` });
            }
        } catch (error: any) {
            console.error("Error applying referrer bonus:", error);
            toast({ title: "Referral Bonus Error", description: error.message, variant: "destructive"});
        }
    }
  }, [authUser, appUser, globalSettings, toast, onRefresh]);


  useEffect(() => {
    applyReferralBonusIfNeeded();
  }, [applyReferralBonusIfNeeded]);


  useEffect(() => {
    if (!appUser) {
      setIsLoading(false);
      return;
    }

    if (!database) {
      toast({ title: "DB Error", description: "Firebase database not initialized.", variant: "destructive" });
      setTransactions([]);
      setIsLoading(false);
      return;
    }
    
    const transactionsQuery = ref(database, `walletTransactions/${appUser.id}`);
    const unsubscribeTransactions = onValue(transactionsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const transactionsData = snapshot.val();
        const fetchedTransactions: WalletTransaction[] = Object.keys(transactionsData).map(txId => ({
          id: txId,
          ...transactionsData[txId],
        }));
        setTransactions(fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setTransactions([]);
      }
    }, (error) => {
      console.error("Error fetching transactions:", error);
      toast({ title: "Transactions Error", description: "Could not get transaction history.", variant: "destructive"});
    });

    const settingsRef = ref(database, 'globalSettings');
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setGlobalSettings(snapshot.val());
      } else {
        console.warn("Global settings not found, using mock data as fallback.");
        setGlobalSettings(mockGlobalSettings);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      setGlobalSettings(mockGlobalSettings);
      setIsLoading(false);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeSettings();
    };
  }, [appUser, toast]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading wallet...</p>
      </div>
    );
  }

  if (!appUser) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You need to be logged in to view your wallet.</p>
        <Button variant="default" className="neon-accent-bg" asChild>
          <Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" />Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-8 space-y-8">
      <WalletDisplay 
        user={appUser} 
        transactions={transactions} 
        firebaseUser={authUser}
        settings={globalSettings}
        onRefresh={refreshUser}
      />
      
      {/* AdSense Display Ad Unit */}
      <GlassCard className="p-4 md:p-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">Advertisement</p>
          <AdSenseDisplayAd />
      </GlassCard>
    </div>
  );
}
