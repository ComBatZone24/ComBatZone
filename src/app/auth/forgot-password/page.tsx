
"use client";

import { useState, useEffect } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import GlassCard from "@/components/core/glass-card";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";
import AppLogo from "@/components/core/AppLogo";

export default function ForgotPasswordPage() {
  const [appName, setAppName] = useState('Arena Ace');
  const [appLogoUrl, setAppLogoUrl] = useState('');

  useEffect(() => {
    if (!database) return;
    const settingsRef = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val();
        setAppName(settings.appName || 'Arena Ace');
        setAppLogoUrl(settings.appLogoUrl || '');
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-slate-900">
      <AppLogo appName={appName} appLogoUrl={appLogoUrl} className="absolute top-6 left-6 text-foreground/80 hover:text-accent transition-colors z-10" />
      <GlassCard className="w-full max-w-md p-8 md:p-10 shadow-2xl border-accent/20">
        <div className="text-center mb-8">
          <KeyRound className="mx-auto h-16 w-16 text-accent mb-4 neon-accent-text"/>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 neon-accent-text">Reset Your Password</h1>
          <p className="text-muted-foreground">Enter your email to receive a reset link.</p>
        </div>
        <ForgotPasswordForm />
      </GlassCard>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/auth/login" legacyBehavior>
            <a className="font-semibold text-accent hover:underline hover:text-accent/80 transition-colors">
              Log In
            </a>
          </Link>
        </p>
    </div>
  );
}
