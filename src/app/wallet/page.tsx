
"use client";

import { useEffect, useState } from 'react';
import WalletDisplay from '@/components/wallet/wallet-display';
import type { WalletTransaction, GlobalSettings } from '@/types';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { mockGlobalSettings } from '@/lib/mock-data';
import { useAuth } from '@/context/AuthContext';


export default function WalletPage() {
  const { user: appUser, authUser, loading: isAuthLoading, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
  const { toast } = useToast();
  
  useEffect(() => {
    // Wait for auth to finish and user object to be available
    if (isAuthLoading || !appUser?.id || !database) {
      if(!isAuthLoading) { // If auth is done but no user/db, clear data
        setTransactions([]);
        setGlobalSettings({});
      }
      return;
    }
    
    const userId = appUser.id;
    const transactionsQuery = ref(database, `walletTransactions/${userId}`);
    const settingsRef = ref(database, 'globalSettings');

    const onTransactionValue = onValue(transactionsQuery, (snapshot) => {
      const transactionsData = snapshot.val();
      const fetchedTransactions: WalletTransaction[] = transactionsData 
        ? Object.keys(transactionsData).map(txId => ({ id: txId, ...transactionsData[txId] }))
        : [];
      setTransactions(fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => {
      console.error("Error fetching transactions:", error);
      toast({ title: "Transactions Error", description: "Could not get transaction history.", variant: "destructive"});
    });

    const onSettingsValue = onValue(settingsRef, (snapshot) => {
      setGlobalSettings(snapshot.exists() ? snapshot.val() : mockGlobalSettings);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      setGlobalSettings(mockGlobalSettings);
    });

    return () => {
      off(transactionsQuery, 'value', onTransactionValue);
      off(settingsRef, 'value', onSettingsValue);
    };
  }, [appUser, isAuthLoading, toast]);


  if (isAuthLoading) {
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
        firebaseUser={authUser}
        transactions={transactions} 
        settings={globalSettings}
        onRefresh={refreshUser}
      />
    </div>
  );
}
