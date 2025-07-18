
"use client";

import { AlertTriangle, Cpu, Wand2, Gamepad2 } from 'lucide-react';
import AppLogo from '@/components/core/AppLogo';
import GlassCard from '@/components/core/glass-card';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const maintenanceMessages = [
  "The Arena is being polished for your next battle. We'll be back shortly!",
  "Our champions are taking a short break. We'll be back online soon.",
  "We're upgrading the Watch & Earn system for bigger rewards! Hang tight.",
  "Performing scheduled maintenance to improve your gaming experience.",
  "Server is currently under heavy load. Please try again in a few moments."
];

const OfflinePage = () => {
  const [randomMessage, setRandomMessage] = useState('');

  useEffect(() => {
    // Select a random message on component mount
    const randomIndex = Math.floor(Math.random() * maintenanceMessages.length);
    setRandomMessage(maintenanceMessages[randomIndex]);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <AppLogo appName="Arena Ace" className="absolute top-6 left-6" />
      <GlassCard className="w-full max-w-lg text-center p-8 md:p-12 shadow-2xl border-accent/20">
        <div className="mx-auto h-20 w-20 text-accent mb-6 flex items-center justify-center">
            <Wand2 className="h-full w-full animate-pulse" />
        </div>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 neon-accent-text">
            We'll Be Right Back
          </h1>
          <p className="text-md text-muted-foreground">
            {randomMessage || "The application is currently unavailable. Please try again later."}
          </p>
        </div>
         <Button asChild className="w-full neon-accent-bg">
            <Link href="/tap-game">
                <Gamepad2 className="mr-2 h-5 w-5" />
                Play a Game While You Wait
            </Link>
        </Button>
      </GlassCard>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Arena Ace. All rights reserved.
      </p>
    </div>
  );
};

export default OfflinePage;
