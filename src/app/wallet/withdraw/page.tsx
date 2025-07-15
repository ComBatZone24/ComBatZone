"use client";

import Link from 'next/link';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowLeft } from 'lucide-react';

export default function WithdrawPageRedirect() {
  return (
    <div className="space-y-8 pt-2 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <GlassCard className="max-w-lg mx-auto p-6 md:p-8 text-center">
        <Wallet className="mx-auto h-16 w-16 text-accent mb-6" />
        <h2 className="text-3xl font-bold text-foreground mb-4">Request Withdrawal</h2>
        <p className="text-muted-foreground mb-8">
          To request a withdrawal, please go to your main wallet page. The withdrawal form is now available as a pop-up there.
        </p>
        <Button asChild className="neon-accent-bg">
          <Link href="/wallet">
            <ArrowLeft className="mr-2 h-5 w-5" /> Go to My Wallet
          </Link>
        </Button>
      </GlassCard>
    </div>
  );
}
