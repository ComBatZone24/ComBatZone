
"use client";

import { useState, useEffect } from 'react';
import { SignupForm } from "@/components/auth/signup-form";
import GlassCard from "@/components/core/glass-card";
import Link from "next/link";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { database } from '@/lib/firebase/config';
import { ref, get, onValue } from 'firebase/database';
import AppLogo from '@/components/core/AppLogo';
import React from 'react';
interface SignupPageProps { 
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function SignupPage({ searchParams }: SignupPageProps) {
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
      {/* Use React.use() to unwrap searchParams within a client component that supports Suspense */}
      {/* Pass the unwrapped searchParams to SignupContent */}
      <SignupContent searchParams={searchParams} />
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

interface SignupContentProps {
 searchParams?: { [key: string]: string | string[] | undefined };
}

function SignupContent({ searchParams }: SignupContentProps) {
   // Use React.use() to unwrap searchParams inside the client component
  const unwrappedSearchParams = React.use(searchParams || {});
  const [isLoading, setIsLoading] = useState(true);
  const [canRegister, setCanRegister] = useState(true);
  const [message, setMessage] = useState("");

  // Define message templates for each scenario
  const registrationClosedMessages = [
    "Hold Tight, Champion! New registrations are taking a short break. Join us tomorrow to forge your legend on Arena Ace!",
    "Registrations Resume Tomorrow! We're currently optimizing for new players. Check back here tomorrow to create your account.",
    "Summoning New Players Soon! Registrations are temporarily paused. Return tomorrow to answer the call!",
    "Get Ready! We're preparing for a fresh wave of champions. New registration slots open tomorrow! Don't miss your chance to join the action.", // Added back the original one as a template
  ];

  const limitReachedMessages = [
    "Registration limit reached ({limit} users). More champion slots opening tomorrow! Be ready to join.",
    "We've hit our champion cap for today! ({limit} users registered). Check back tomorrow for new openings.",
    "All spots filled for now ({limit} users). A new day brings new opportunities! Return tomorrow to register.",
    "Today's registration quest is complete ({limit} users). Your chance to join awaits tomorrow!",
  ];

  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!database) {
        console.error("Firebase Database not initialized.");
        setIsLoading(false); // Set loading to false on error
        setCanRegister(false);
        setMessage("An error occurred while checking registration status.");
        return;
      }

      try {
        const globalSettingsRef = ref(database, 'globalSettings');
        const userCountRef = ref(database, 'userCount');

        const [settingsSnapshot, userCountSnapshot] = await Promise.all([
          get(globalSettingsRef),
          get(userCountRef)
        ]);

        const globalSettings = settingsSnapshot.exists() ? settingsSnapshot.val() : {}; // Default to empty object if settings node doesn't exist
        const totalUsers = userCountSnapshot.exists() ? Number(userCountSnapshot.val()) : 0;

        const registrationEnabled = globalSettings.registrationEnabled !== false; // Default to true if not set
        const limitEnabled = globalSettings.limitRegistrationsEnabled === true; // Explicitly check for true
        const maxRegistrations = globalSettings.maxRegistrations ? Number(globalSettings.maxRegistrations) : Infinity; // Default to Infinity if not set or invalid

        if (!registrationEnabled) {
          // Updated message for when registrations are globally disabled
          setCanRegister(false);
          setMessage("Get Ready! We're preparing for a fresh wave of champions. New registration slots open tomorrow! Don't miss your chance to join the action.");
        } else if (limitEnabled && totalUsers >= maxRegistrations) {
          // Updated message for when the registration limit is reached
          setCanRegister(false);
          setMessage(`Registration limit reached (${maxRegistrations} users). More champion slots opening tomorrow! Be ready to join.`);
        } else {
          setCanRegister(true);
          setMessage(""); // Clear any previous messages
        }
      } catch (error) {
        console.error("Error fetching registration settings or user count:", error);
        setCanRegister(false);
        setMessage("An error occurred while checking registration status. Please try again later."); // Slightly more informative error message
      } finally {
        setIsLoading(false);
      }
    };

    checkRegistrationStatus();
  }, []); // Empty dependency array means this effect runs only once after initial render

  const initialReferralCode = typeof unwrappedSearchParams.ref === 'string' ? unwrappedSearchParams.ref : undefined;
  if (isLoading) {
    return (
      <GlassCard className="w-full max-w-lg p-8 md:p-10 shadow-2xl border-accent/20 flex flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-accent mb-4" />
        <p className="text-foreground">Checking registration status...</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full max-w-lg p-8 md:p-10 shadow-2xl border-accent/20">
      <div className="text-center mb-8">
        <ShieldCheck className="mx-auto h-16 w-16 text-accent mb-4 neon-accent-text"/>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 neon-accent-text">Forge Your Legend</h1>
        <p className="text-muted-foreground">Create your account and join the battle!</p>
      </div>
      {canRegister ? (
        <SignupForm initialReferralCode={initialReferralCode} />
      ) : (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Registration Unavailable</AlertTitle>
          <AlertDescription>
            {message}
          </AlertDescription>
        </Alert>
      )}
    </GlassCard>
  );
}
