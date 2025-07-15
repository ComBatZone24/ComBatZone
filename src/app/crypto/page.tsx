
"use client";

import { useEffect, useState } from 'react';
import WalletDisplay from '@/components/wallet/wallet-display';
import type { User as AppUserType, GlobalSettings } from '@/types';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import GlassCard from '@/components/core/glass-card';
import CryptoWallet from '@/components/crypto/CryptoWallet';
import PageTitle from '@/components/core/page-title';
import { mockGlobalSettings } from '@/lib/mock-data';

export default function CryptoPage() {
  const { user: appUser, loading: isAuthLoading } = useAuth();
  const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const { toast } = useToast();
  
  const tokenSettings = globalSettings?.tokenSettings;

  useEffect(() => {
    if (!database) {
      console.warn("CryptoPage: Firebase DB not available.");
      setGlobalSettings(mockGlobalSettings);
      setIsLoadingSettings(false);
      return;
    }
    
    const settingsRef = ref(database, 'globalSettings');
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setGlobalSettings(snapshot.val());
      } else {
        setGlobalSettings(mockGlobalSettings);
      }
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      toast({ title: "Settings Error", description: "Could not load token settings.", variant: "destructive" });
      setIsLoadingSettings(false);
    });

    return () => unsubscribeSettings();
  }, [toast]);
  
  const isLoading = isAuthLoading || isLoadingSettings;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Crypto Wallet...</p>
      </div>
    );
  }
  
  if (!appUser) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You need to be logged in to access the Crypto Wallet.</p>
        <Button variant="default" className="neon-accent-bg" asChild>
          <Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" />Login</Link>
        </Button>
      </div>
    );
  }
  
  if (!tokenSettings || !tokenSettings.enabled) {
      return (
        <div className="text-center py-20">
            <AlertTriangle className="mx-auto h-16 w-16 text-yellow-400 mb-4" />
            <h1 className="text-2xl font-semibold text-foreground mb-2">Feature Disabled</h1>
            <p className="text-muted-foreground mb-6">The in-app token system is currently disabled by the administrator.</p>
        </div>
      );
  }

  return (
    <div className="pt-8 space-y-8">
      <PageTitle title={tokenSettings.tokenName || "Crypto Wallet"} subtitle="Buy, sell, and transfer in-app tokens." />
      <CryptoWallet appUser={appUser} tokenSettings={tokenSettings} />
    </div>
  );
}
