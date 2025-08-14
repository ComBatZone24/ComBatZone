
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClickAndEarnLink, User, GlobalSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Video, Check, Gift, AlertTriangle, Coins, Target } from 'lucide-react';
import { database } from '@/lib/firebase/config';
import { ref, update, onValue, off, set, runTransaction } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format } from 'date-fns';
import RupeeIcon from '../core/rupee-icon';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import GlassCard from '../core/glass-card';
import { Separator } from '../ui/separator';
import { trackTaskClick } from '@/app/earn-tasks/actions'; 
import { Zap, Info } from 'lucide-react';
import { Progress } from '../ui/progress';

interface ClickAndEarnComponentProps {
  user: User;
  settings: Partial<GlobalSettings>;
}

type ButtonState =
  | 'loading'
  | 'ready'
  | 'cooldown_all_used'
  | 'limit_reached'
  | 'waiting_for_stay'
  | 'post_reward_cooldown'
  | 'batch_cooldown'; // New state for the 10-click cooldown

export default function ClickAndEarnComponent({ user, settings }: ClickAndEarnComponentProps) {
    const { toast } = useToast();
    const [links, setLinks] = useState<ClickAndEarnLink[]>([]);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    const [userClaims, setUserClaims] = useState(user.userClickAndEarnClaims || {});
    
    const [buttonState, setButtonState] = useState<ButtonState>('loading');
    const [cooldownTimer, setCooldownTimer] = useState(0);

    const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
    const [isEarlyReturnDialogOpen, setIsEarlyReturnDialogOpen] = useState(false);
    const [lastReward, setLastReward] = useState<number>(0);
    const [isConverting, setIsConverting] = useState(false);
    
    const [isConversionDay, setIsConversionDay] = useState(false);

    const activeLinkRef = useRef<ClickAndEarnLink | null>(null);
    const adWindowOpenedAt = useRef<number>(0);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isHandlingVisibilityChange = useRef(false);
    
    const buttonStateRef = useRef(buttonState);
    useEffect(() => { buttonStateRef.current = buttonState; }, [buttonState]);
    
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);
    
    const pkrPerPoint = settings.pkrPerPoint || 0;
    const userPoints = user.watchAndEarnPoints || 0;
    
    const dailyTargetReward = settings.dailyTargetReward || 0;
    
    useEffect(() => {
        const today = new Date();
        const dayOfMonth = today.getDate();
        if (dayOfMonth === 6) {
            setIsConversionDay(true);
        }
    }, []);

    // Fetch links and user progress from Firebase
    useEffect(() => {
        if (!user.id || !database) {
          setIsLoadingLinks(false);
          return;
        }

        const linksRef = ref(database, 'clickAndEarnLinks');
        const userClaimsRef = ref(database, `users/${user.id}/userClickAndEarnClaims`);

        const linksListener = onValue(linksRef, (snapshot) => {
            const data = snapshot.val();
            setLinks(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
            setIsLoadingLinks(false);
        });

        const claimsListener = onValue(userClaimsRef, (snapshot) => {
            setUserClaims(snapshot.val() || {});
        });
        
        return () => {
            off(linksRef, 'value', linksListener);
            off(userClaimsRef, 'value', claimsListener);
        };
    }, [user.id]);

    const requiredStaySeconds = settings.dailyAdTaskSettings?.stayDurationSeconds ?? 10;
    const postRewardCooldownSeconds = settings.dailyAdTaskSettings?.postRewardCooldownSeconds ?? 5;
    const linkRepeatHours = settings.dailyAdTaskSettings?.linkRepeatHours ?? 24;
    const dailyClickTarget = settings.dailyTargetClicks || 98;

    const startCooldown = useCallback((type: 'post_reward' | 'batch', duration?: number) => {
        const cooldownSeconds = type === 'post_reward' ? postRewardCooldownSeconds : duration || 0;
        if (cooldownSeconds <= 0) {
            setButtonState('loading');
            return;
        }
        
        setButtonState(type === 'post_reward' ? 'post_reward_cooldown' : 'batch_cooldown');
        setCooldownTimer(cooldownSeconds);

        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        countdownIntervalRef.current = setInterval(() => {
            setCooldownTimer(prev => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current!);
                    setButtonState('loading');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [postRewardCooldownSeconds]);


     const awardPoints = useCallback(async (link: ClickAndEarnLink) => {
        const currentUser = userRef.current;
        if (!currentUser || !currentUser.id) return;

        const now = Date.now();
        const userDailyTaskRef = ref(database, `users/${currentUser.id}/dailyClickAndEarn`);
        const userClaimsRef = ref(database, `users/${currentUser.id}/userClickAndEarnClaims/${link.id}`);
        const userPointsRef = ref(database, `users/${currentUser.id}/watchAndEarnPoints`);

        try {
            const transactionResult = await runTransaction(userDailyTaskRef, (currentTaskData) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                if (!currentTaskData || currentTaskData.date !== todayStr) {
                    return { date: todayStr, clickCount: 1, batchCooldownUntil: 0 };
                }
                const newClickCount = (currentTaskData.clickCount || 0) + 1;
                
                // Set new batch cooldown if a 20-click milestone is hit
                if (newClickCount % 20 === 0 && newClickCount < dailyClickTarget) {
                    const randomMinutes = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
                    currentTaskData.batchCooldownUntil = Date.now() + randomMinutes * 60 * 1000;
                }
                
                currentTaskData.clickCount = newClickCount;
                return currentTaskData;
            });

            await set(userClaimsRef, now);
            await trackTaskClick(currentUser.id, 'click_and_earn');

            const updatedTaskData = transactionResult.snapshot.val();
            const newClickCount = updatedTaskData?.clickCount || 0;

            if (newClickCount === dailyClickTarget) {
                const rewardAmount = dailyTargetReward || 0;
                if (rewardAmount > 0) {
                    await runTransaction(userPointsRef, (currentPoints) => (currentPoints || 0) + rewardAmount);
                    setLastReward(rewardAmount);
                    setIsRewardDialogOpen(true);
                    setTimeout(() => setIsRewardDialogOpen(false), 2500);
                }
            }
            
            // Check if we need to start a batch cooldown immediately
            if (updatedTaskData.batchCooldownUntil && updatedTaskData.batchCooldownUntil > Date.now()) {
                const remainingSeconds = Math.floor((updatedTaskData.batchCooldownUntil - Date.now()) / 1000);
                startCooldown('batch', remainingSeconds);
            } else {
                startCooldown('post_reward');
            }

        } catch (error: any) {
            toast({ title: "Error", description: "Could not process your claim. Please try again.", variant: "destructive"});
            setButtonState('ready');
        }
    }, [dailyClickTarget, dailyTargetReward, toast, startCooldown]);

    const handleButtonClick = useCallback(() => {
        if (!activeLinkRef.current) {
            toast({title: "No Task", description: "No available task to start.", variant: "destructive"});
            return;
        }
        
        window.open(activeLinkRef.current.url, '_blank', 'noopener,noreferrer');
        adWindowOpenedAt.current = Date.now();
        setButtonState('waiting_for_stay');

    }, [toast]);
    
    useEffect(() => {
        const handleVisibilityChange = () => {
          if (document.visibilityState !== 'visible' || buttonStateRef.current !== 'waiting_for_stay' || isHandlingVisibilityChange.current) {
            return;
          }
          isHandlingVisibilityChange.current = true;

          const timeElapsed = Date.now() - adWindowOpenedAt.current;
          const visitedLink = activeLinkRef.current;
            
          activeLinkRef.current = null;
    
          if (visitedLink) {
            if (timeElapsed < requiredStaySeconds * 1000) {
              setIsEarlyReturnDialogOpen(true);
            } else {
              awardPoints(visitedLink);
            }
          }
          setButtonState('loading');
          setTimeout(() => { isHandlingVisibilityChange.current = false; }, 500);
        };
      
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [awardPoints, requiredStaySeconds]);
    
    // Main state determination logic
    useEffect(() => {
      if (buttonState === 'post_reward_cooldown' || buttonState === 'waiting_for_stay' || buttonState === 'batch_cooldown') {
        return;
      }
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
      if (isLoadingLinks) {
        setButtonState('loading');
        return;
      }
      
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const dailyClickCount = (user.dailyClickAndEarn?.date === todayStr) ? (user.dailyClickAndEarn.clickCount || 0) : 0;
      const batchCooldownUntil = (user.dailyClickAndEarn?.date === todayStr) ? (user.dailyClickAndEarn.batchCooldownUntil || 0) : 0;
      
      if (dailyClickCount >= dailyClickTarget) {
        setButtonState('limit_reached');
        activeLinkRef.current = null;
        return;
      }
      
      if (batchCooldownUntil > Date.now()) {
          const remainingSeconds = Math.floor((batchCooldownUntil - Date.now()) / 1000);
          startCooldown('batch', remainingSeconds);
          return;
      }
    
      const linkRepeatMilliseconds = (linkRepeatHours || 24) * 60 * 60 * 1000;
      const timeThreshold = Date.now() - linkRepeatMilliseconds;

      const availableLinks = links.filter(link => {
        const lastClaimed = userClaims[link.id];
        return !lastClaimed || lastClaimed < timeThreshold;
      });
    
      if (availableLinks.length > 0) {
        activeLinkRef.current = availableLinks[Math.floor(Math.random() * availableLinks.length)];
        setButtonState('ready');
      } else {
        activeLinkRef.current = null;
        setButtonState('cooldown_all_used');
      }
    }, [user.dailyClickAndEarn, userClaims, links, isLoadingLinks, buttonState, linkRepeatHours, dailyClickTarget, startCooldown]);

    const canConvert = isConversionDay && userPoints >= 20;

    const handleConvertPoints = async () => {
        if (!canConvert || !user.id) return;
        if (isConverting) return;
        if (pkrPerPoint <= 0) {
            toast({ title: "Conversion Error", description: "Conversion rate not set correctly by admin.", variant: "destructive" });
            return;
        }

        setIsConverting(true);
        const pointsToConvert = userPoints; // Convert all points
        const amountToCredit = parseFloat((pointsToConvert * pkrPerPoint).toFixed(2));
        
        try {
            if (!database) throw new Error("Firebase not initialized.");

            const userRef = ref(database, `users/${user.id}`);
            await runTransaction(userRef, (currentData: User | null) => {
                if (currentData) {
                    if ((currentData.watchAndEarnPoints || 0) >= pointsToConvert) {
                        currentData.wallet = (currentData.wallet || 0) + amountToCredit;
                        currentData.watchAndEarnPoints = (currentData.watchAndEarnPoints || 0) - pointsToConvert;
                    }
                }
                return currentData;
            });
            
            const newTx = {
                type: 'watch_earn_conversion', amount: amountToCredit, status: 'completed',
                date: new Date().toISOString(), description: `Converted ${pointsToConvert.toFixed(4)} points to PKR`,
            };
            await push(ref(database, `walletTransactions/${user.id}`), newTx);
            toast({ title: "Conversion Successful!", description: `You converted ${pointsToConvert.toFixed(4)} points to Rs ${amountToCredit.toFixed(2)}.`, className: "bg-green-500/20" });

        } catch (error: any) {
            toast({ title: "Conversion Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsConverting(false);
        }
    };
    
    const renderButtonContent = () => {
        const formatTime = (totalSeconds: number) => {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        switch(buttonState) {
            case 'loading': return <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading Tasks...</>;
            case 'cooldown_all_used': return <><Clock className="mr-2 h-5 w-5"/> All Links Used, Check Back Later</>;
            case 'limit_reached': return <><Check className="mr-2 h-5 w-5"/> Daily Target Reached</>;
            case 'waiting_for_stay': return <><Clock className="mr-2 h-5 w-5"/> Return after {requiredStaySeconds}s</>;
            case 'post_reward_cooldown': return <div className="flex items-center gap-2"><Clock className="h-5 w-5"/><span>Next task in... {cooldownTimer}s</span></div>;
            case 'batch_cooldown': return <div className="flex items-center gap-2"><Clock className="h-5 w-5"/><span>Next batch in... {formatTime(cooldownTimer)}</span></div>;
            case 'ready': default: return <><Video className="mr-2 h-5 w-5"/> Watch Ad & Earn</>;
      }
    };

    const isDisabled = buttonState !== 'ready';
    
    const showDailyTarget = !!settings.dailyTargetClicks;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const dailyClickCount = (user.dailyClickAndEarn?.date === todayStr) ? (user.dailyClickAndEarn.clickCount || 0) : 0;
    
    return (
        <GlassCard className="p-4 md:p-6 text-center">
             <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center justify-center gap-2">
                <Gift className="h-7 w-7 text-yellow-400" /> Ad Link Task
            </h3>
            
            {showDailyTarget && dailyClickTarget > 0 && (
                <div className="mb-4 px-2">
                    <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Target className="h-4 w-4"/> Daily Target</span>
                        <span className="font-semibold text-foreground">
                            {dailyClickCount} / {dailyClickTarget}
                        </span>
                    </div>
                    <Progress value={(dailyClickCount / dailyClickTarget) * 100} className="h-2" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 my-4">
                <div className="p-3 rounded-md bg-muted/40 text-center">
                    <p className="text-xs text-muted-foreground">Points Balance</p>
                    <p className="font-bold text-lg text-foreground">{(user.watchAndEarnPoints || 0).toFixed(4)}</p>
                </div>
                 <div className="p-3 rounded-md bg-muted/40 text-center">
                    <p className="text-xs text-muted-foreground">Est. PKR Value</p>
                    <p className="font-bold text-lg text-green-400 flex items-center justify-center gap-1">
                        <RupeeIcon className="h-4"/>
                        {(userPoints * pkrPerPoint).toFixed(2)}
                    </p>
                </div>
            </div>

            <Button onClick={handleButtonClick} disabled={isDisabled} className="w-full neon-accent-bg py-4 md:py-6 text-md md:text-lg">
                {renderButtonContent()}
            </Button>
            
            <Separator className="my-6 bg-border/50"/>

            <div className="space-y-3">
                <h4 className="text-lg font-semibold text-foreground">Convert Points</h4>
                 <Button onClick={handleConvertPoints} disabled={isConverting || !canConvert} className="w-full">
                    {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Convert All Points to Wallet
                </Button>

                <Alert variant="default" className="bg-primary/10 border-primary/30 text-left">
                    <Info className="h-4 w-4 !text-primary" />
                    <AlertTitle className="!text-primary text-sm">Conversion Rules</AlertTitle>
                    <AlertDescription className="!text-primary/80 text-xs">
                       Point conversion is only available on the 6th of each month. A minimum of 20 points is required to convert.
                    </AlertDescription>
                </Alert>
            </div>

            <Dialog open={isRewardDialogOpen} onOpenChange={setIsRewardDialogOpen}>
                <DialogContent className="glass-card sm:max-w-sm text-center p-8">
                    <DialogHeader>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/20 mb-4 border-2 border-yellow-400 shadow-lg">
                            <Zap className="h-10 w-10 text-yellow-400" />
                        </div>
                        <DialogTitle className="text-2xl text-yellow-300">Target Reached!</DialogTitle>
                        <DialogDescription className="text-foreground text-5xl font-bold my-4">
                            +{lastReward}
                        </DialogDescription>
                        <p className="text-sm text-muted-foreground">points awarded!</p>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
            <Dialog open={isEarlyReturnDialogOpen} onOpenChange={setIsEarlyReturnDialogOpen}>
                <DialogContent className="glass-card sm:max-w-sm text-center p-8 border-destructive/50">
                    <DialogHeader>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20 mb-4 border-2 border-destructive">
                            <AlertTriangle className="h-10 w-10 text-destructive" />
                        </div>
                        <DialogTitle className="text-2xl text-destructive">Returned Too Soon!</DialogTitle>
                        <DialogDescription className="text-foreground text-md my-4">
                            Please wait for the full {requiredStaySeconds} seconds on the ad page to get your reward.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" className="w-full">Got It</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </GlassCard>
    );
}
