
"use client";

import { useEffect, useState, useCallback } from 'react';
import WalletDisplay from '@/components/wallet/wallet-display';
import type { User, WalletTransaction, GlobalSettings } from '@/types';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { database, auth } from '@/lib/firebase/config';
import { ref, onValue, off, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/core/glass-card';
import { Coins } from 'lucide-react';
import Image from 'next/image';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import { mockGlobalSettings } from '@/lib/mock-data';

const defaultUserProfile: User = {
  id: '',
  username: 'User',
  email: 'user@example.com',
  phone: '',
  wallet: 0,
  role: 'user',
  isActive: false,
  lastLogin: new Date(0).toISOString(),
  onlineStreak: 0,
  avatarUrl: '',
  gameUid: '',
  gameName: '',
  referralCode: '',
  appliedReferralCode: null,
  referralBonusReceived: 0,
  totalReferralCommissionsEarned: 0,
  createdAt: new Date().toISOString(),
};

export default function WalletPage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null); 
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
  const { toast } = useToast();

  const refreshWalletData = useCallback(async () => {
    if (!firebaseUser || !database) return;
    try {
      const userRef = ref(database, `users/${firebaseUser.uid}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        setUserProfile({ id: firebaseUser.uid, ...userSnapshot.val() } as User);
      }

      const transactionsQuery = ref(database, `walletTransactions/${firebaseUser.uid}`);
      const transactionsSnapshot = await get(transactionsQuery);
      if (transactionsSnapshot.exists()) {
        const transactionsData = transactionsSnapshot.val();
        const fetchedTransactions: WalletTransaction[] = Object.keys(transactionsData).map(txId => ({
          id: txId,
          ...transactionsData[txId],
        }));
        setTransactions(fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error refreshing wallet data:", error);
      toast({ title: "Refresh Failed", description: "Could not update wallet data.", variant: "destructive" });
    }
  }, [firebaseUser, toast]);

  useEffect(() => {
    if (!auth) {
      toast({ title: "Error", description: "Firebase auth not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    let userListeners: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      userListeners.forEach(unsub => unsub());
      userListeners = [];

      setIsLoading(true);
      setFirebaseUser(user);
      
      if (user) {
        if (!database) {
          toast({ title: "DB Error", description: "Firebase database not initialized.", variant: "destructive" });
          setUserProfile({ ...defaultUserProfile, id: user.uid, email: user.email || defaultUserProfile.email, username: user.displayName || defaultUserProfile.username });
          setTransactions([]);
          setIsLoading(false);
          return;
        }
        
        const userRef = ref(database, `users/${user.uid}`);
        const unsubscribeUser = onValue(userRef, (snapshot) => {
          let currentProfile: User;
          if (snapshot.exists()) {
            const fetchedData = snapshot.val();
            currentProfile = {
              ...defaultUserProfile,
              id: user.uid,
              email: user.email || fetchedData.email || defaultUserProfile.email,
              username: fetchedData.username || user.displayName || user.email?.split('@')[0] || defaultUserProfile.username,
              ...fetchedData,
              wallet: fetchedData.wallet !== undefined ? Number(fetchedData.wallet) : defaultUserProfile.wallet,
            };
          } else {
            currentProfile = {
              ...defaultUserProfile,
              id: user.uid,
              email: user.email || defaultUserProfile.email,
              username: user.displayName || user.email?.split('@')[0] || defaultUserProfile.username,
            };
             console.warn(`WalletPage: User data for ${user.uid} not found in Firebase DB. Using defaults.`);
          }
          setUserProfile(currentProfile);
          setIsLoading(false); 
        }, (error) => {
          console.error("Error fetching user profile:", error);
          toast({ title: "Profile Error", description: "Could not get your profile.", variant: "destructive"});
          setIsLoading(false);
        });
        userListeners.push(unsubscribeUser);
        
        const transactionsQuery = ref(database, `walletTransactions/${user.uid}`);
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
        userListeners.push(unsubscribeTransactions);

        const settingsRef = ref(database, 'globalSettings');
        const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
          if (snapshot.exists()) {
            setGlobalSettings(snapshot.val());
          } else {
            console.warn("Global settings not found, using mock data as fallback.");
            setGlobalSettings(mockGlobalSettings);
          }
        }, (error) => {
          console.error("Error fetching global settings:", error);
          setGlobalSettings(mockGlobalSettings);
        });
        userListeners.push(unsubscribeSettings);

      } else {
        setFirebaseUser(null);
        setUserProfile(null);
        setTransactions([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      userListeners.forEach(unsub => unsub());
    };
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading wallet...</p>
      </div>
    );
  }

  if (!firebaseUser) {
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

  if (!userProfile) {
     return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Wallet Data Unavailable</h1>
        <p className="text-muted-foreground mb-6">Could not load your user details for the wallet. If you just signed up, please try again in a moment or contact support if the issue persists.</p>
         <Button variant="outline" asChild>
            <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-8 space-y-8">
      <WalletDisplay 
        user={userProfile} 
        transactions={transactions} 
        firebaseUser={firebaseUser} 
        settings={globalSettings}
        onRefresh={refreshWalletData}
      />
    </div>
  );
}
