
"use client";

import SpinWheelGame from "@/components/spin-wheel/SpinWheelGame";
import PageTitle from "@/components/core/page-title";
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, LogIn } from 'lucide-react';
import GlassCard from "@/components/core/glass-card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function SpinWheelPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-accent"/>
        </div>
    );
  }
    
  if (!user) {
    return (
        <GlassCard className="mt-8 p-8 text-center max-w-md mx-auto">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">
                You must be logged in to spin the wheel.
            </p>
            <Button asChild>
                <Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" /> Go to Login</Link>
            </Button>
        </GlassCard>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <PageTitle title="Spin the Wheel" subtitle="Place your bet and spin for a chance to multiply your winnings!" />
      <SpinWheelGame />
    </div>
  );
}
