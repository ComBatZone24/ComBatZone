
import { SignupForm } from "@/components/auth/signup-form";
import GlassCard from "@/components/core/glass-card";
import Link from "next/link";
import { Award } from "lucide-react";
import AppLogo from '@/components/core/AppLogo';
import React from 'react';
// Removed client-side Firebase imports:
// import { database } from '@/lib/firebase/config';
// import { ref, onValue } from 'firebase/database';

// This is the main SERVER component. It's responsible for layout and handling server-side data like searchParams.
export default function SignupPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  // Referral code is now safely extracted on the server side.
  const initialReferralCode = typeof searchParams?.ref === 'string' ? searchParams.ref : undefined;
  
  // We are not fetching appName and appLogoUrl here anymore to keep it a pure Server Component.
  // The client components (`AppLogo` and `SignupForm`) already handle fetching this dynamic data where needed.

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-slate-900">
      {/* AppLogo is a client component and will fetch its own data */}
      <AppLogo className="absolute top-6 left-6 text-foreground/80 hover:text-accent transition-colors z-10" />
      
      <GlassCard className="w-full max-w-lg p-8 md:p-10 shadow-2xl border-accent/20">
        <div className="text-center mb-8">
          <Award className="mx-auto h-16 w-16 text-accent mb-4 neon-accent-text"/>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 neon-accent-text">Join the eSports Arena</h1>
          <p className="text-muted-foreground">Create your account to compete in daily tournaments and win prizes.</p>
        </div>
        {/* Pass the server-extracted code to the client component */}
        <SignupForm initialReferralCode={initialReferralCode} />
      </GlassCard>

      <p className="mt-8 text-center text-sm text-muted-foreground">
          Already a champion?{" "}
          <Link href="/auth/login" legacyBehavior>
            <a className="font-semibold text-accent hover:underline hover:text-accent/80 transition-colors">
              Log In Here
            </a>
          </Link>
        </p>
    </div>
  );
}
