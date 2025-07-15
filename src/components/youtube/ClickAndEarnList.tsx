
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ClickAndEarnLink, User, GlobalSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Video, Check } from 'lucide-react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, set, runTransaction, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import GlassCard from '../core/glass-card';
import { format } from 'date-fns';

interface ClickAndEarnListProps {
  links: ClickAndEarnLink[];
  user: User | null;
  settings: Partial<GlobalSettings>;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const POST_CLICK_COOLDOWN_SECONDS = 15;

type ButtonState = 'loading' | 'ready' | 'cooldown' | 'limit_reached';

export default function ClickAndEarnList({ links, user, settings }: ClickAndEarnListProps) {
  const { toast } = useToast();
  const [userClaims, setUserClaims] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>('loading');
  const [nextLink, setNextLink] = useState<ClickAndEarnLink | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState('');
  const [postClickCooldown, setPostClickCooldown] = useState(0);

  const dailyLimit = settings.dailyPointsLimit ?? Infinity;
  const userDailyData = user?.dailyClickAndEarn || { points: 0, date: format(new Date(), 'yyyy-MM-dd') };
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const currentDailyPoints = userDailyData.date === todayStr ? userDailyData.points : 0;
  const hasReachedDailyLimit = currentDailyPoints >= dailyLimit;

  useEffect(() => {
    if (!user) {
      setButtonState('loading');
      return;
    }
    const claimsRef = ref(database, `userClickAndEarnClaims/${user.id}`);
    const unsubscribe = onValue(claimsRef, (snapshot) => {
      setUserClaims(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [user]);

  const determineButtonState = useCallback(() => {
    if (!user || links.length === 0) {
      setButtonState('loading');
      return;
    }

    if (hasReachedDailyLimit) {
        setButtonState('limit_reached');
        return;
    }

    const now = Date.now();
    const claimableLinks = links.filter(link => {
      const lastClaimed = userClaims[link.id];
      return !lastClaimed || now - lastClaimed > TWENTY_FOUR_HOURS_MS;
    });

    if (claimableLinks.length > 0) {
      if (!nextLink || !claimableLinks.some(l => l.id === nextLink.id)) {
        setNextLink(claimableLinks[Math.floor(Math.random() * claimableLinks.length)]);
      }
      setButtonState('ready');
    } else {
      setButtonState('cooldown');
      const allClaimTimestamps = links.map(link => userClaims[link.id]).filter(Boolean).filter(ts => typeof ts === 'number');
      if (allClaimTimestamps.length > 0) {
        const nextAvailableTime = Math.min(...allClaimTimestamps) + TWENTY_FOUR_HOURS_MS;
        const timeRemaining = nextAvailableTime - now;

        const hours = Math.floor(timeRemaining / 3600000);
        const minutes = Math.floor((timeRemaining % 3600000) / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        setCooldownTimer(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }
  }, [user, links, userClaims, nextLink, hasReachedDailyLimit]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (postClickCooldown > 0) {
      interval = setInterval(() => {
        setPostClickCooldown(prev => prev - 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [postClickCooldown]);

  useEffect(() => {
    determineButtonState();
    const interval = setInterval(determineButtonState, 5000);
    return () => clearInterval(interval);
  }, [determineButtonState]);

  const proceedToLink = async () => {
    if (!user || !nextLink || isProcessing || hasReachedDailyLimit || postClickCooldown > 0) {
      toast({ title: "Error", description: "Cannot proceed.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    window.open(nextLink.url, '_blank', 'noopener,noreferrer');

    try {
      const now = Date.now();
      
      const userRef = ref(database, `users/${user.id}`);
      const dailyData = (user.dailyClickAndEarn?.date === todayStr) 
            ? user.dailyClickAndEarn 
            : { points: 0, date: todayStr };

      const updates = {
          [`userClickAndEarnClaims/${user.id}/${nextLink.id}`]: now,
          [`users/${user.id}/watchAndEarnPoints`]: (user.watchAndEarnPoints || 0) + nextLink.reward,
          [`users/${user.id}/dailyClickAndEarn`]: {
              points: dailyData.points + nextLink.reward,
              date: todayStr
          }
      };

      await update(ref(database), updates);

      toast({
        title: "Points Awarded!",
        description: `You've earned ${nextLink.reward} points for task: ${nextLink.title || 'Watching Ad'}.`,
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });

      setNextLink(null);
      setPostClickCooldown(POST_CLICK_COOLDOWN_SECONDS); // Start the post-click cooldown
      
    } catch (error: any) {
      toast({ title: "Error", description: "Could not process your claim.", variant: "destructive"});
    } finally {
      setIsProcessing(false); // Reset processing state immediately
    }
  };

  if (!user) {
    return <Button disabled>Login to Earn</Button>;
  }

  if (buttonState === 'loading' || links.length === 0) {
    return <Button disabled className="w-full neon-accent-bg py-4 md:py-6 text-md md:text-lg"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading Tasks...</Button>;
  }
  
  if (postClickCooldown > 0) {
    return <Button disabled variant="secondary" className="w-full py-4 md:py-6 text-md md:text-lg"><Clock className="mr-2 h-5 w-5"/> Next task in... {postClickCooldown}s</Button>;
  }
  
  if (buttonState === 'cooldown') {
    return <Button disabled variant="secondary" className="w-full py-4 md:py-6 text-md md:text-lg"><Clock className="mr-2 h-5 w-5"/> Next task in: {cooldownTimer}</Button>;
  }

  if (buttonState === 'limit_reached') {
      return <Button disabled variant="destructive" className="w-full py-4 md:py-6 text-md md:text-lg"><Check className="mr-2 h-5 w-5"/> Daily Limit Reached</Button>;
  }
  
  return (
    <>
      <Button onClick={proceedToLink} disabled={isProcessing} className="w-full neon-accent-bg py-4 md:py-6 text-md md:text-lg">
          {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Video className="mr-2 h-5 w-5"/>}
          Watch Ad & Earn Now
      </Button>
    </>
  );
}
