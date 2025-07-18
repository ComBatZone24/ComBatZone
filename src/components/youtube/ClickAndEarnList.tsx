

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ClickAndEarnLink, User, GlobalSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Video, Check, Gift, AlertTriangle, Coins, TrendingUp, Info, Zap } from 'lucide-react';
import { database } from '@/lib/firebase/config';
import { ref, update, runTransaction, serverTimestamp, set, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format } from 'date-fns';
import RupeeIcon from '../core/rupee-icon';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import GlassCard from '../core/glass-card';
import { Separator } from '../ui/separator';

interface ClickAndEarnComponentProps {
  user: User;
  settings: Partial<GlobalSettings>;
}

const REQUIRED_STAY_SECONDS = 10;
const POST_REWARD_COOLDOWN_SECONDS = 5;

type ButtonState =
  | 'loading'
  | 'ready'
  | 'cooldown_all_used'
  | 'limit_reached'
  | 'waiting_for_stay'
  | 'post_reward_cooldown';

const FIXED_DAILY_TARGET = 98;


export default function ClickAndEarnComponent({ user, settings }: ClickAndEarnComponentProps) {
    const { toast } = useToast();
    const [links, setLinks] = useState<ClickAndEarnLink[]>([]);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    const [userClaims, setUserClaims] = useState<Record<string, number>>({});
    const [dailyData, setDailyData] = useState(user.dailyClickAndEarn);
    
    const [buttonState, setButtonState] = useState<ButtonState>('loading');
    const [nextLink, setNextLink] = useState<ClickAndEarnLink | null>(null);
    const [cooldownTimer, setCooldownTimer] = useState(0);

    const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
    const [isEarlyReturnDialogOpen, setIsEarlyReturnDialogOpen] = useState(false);
    const [lastReward, setLastReward] = useState<number>(0);
    const [isConverting, setIsConverting] = useState(false);
    
    const [isConversionDay, setIsConversionDay] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const adWindowOpenedAt = useRef<number>(0);

    const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    
    const pkrPerPoint = settings.pkrPerPoint || 0;
    const userPoints = user.watchAndEarnPoints || 0;
    
    const dailyTargetReward = useMemo(() => {
        const milestone = settings.clickMilestones?.find(m => m.clicks === FIXED_DAILY_TARGET);
        return milestone?.points || 0;
    }, [settings.clickMilestones]);
    
    useEffect(() => {
        const today = new Date();
        const dayOfMonth = today.getDate();
        if (dayOfMonth === 6) {
            setIsConversionDay(true);
        }
    }, []);

    useEffect(() => {
        const initializeDailyData = () => {
            if (!user.id || !database) return;
    
            const currentDailyData = user.dailyClickAndEarn;
    
            if (!currentDailyData || currentDailyData.date !== todayStr) {
                const newDailyData = {
                    date: todayStr,
                    clickCount: 0,
                    dailyClickTarget: FIXED_DAILY_TARGET,
                    isTargetCompleted: false,
                };
                setDailyData(newDailyData);
                // Update the database without waiting for it, UI is already updated
                set(ref(database, `users/${user.id}/dailyClickAndEarn`), newDailyData)
                  .catch(err => console.error("Failed to set new daily data:", err));
            } else {
                setDailyData(currentDailyData);
            }
        };
    
        initializeDailyData();
        setUserClaims(user.userClickAndEarnClaims || {});
    }, [user.id, user.dailyClickAndEarn, user.userClickAndEarnClaims, todayStr, settings]);


    useEffect(() => {
        const linksRef = ref(database, 'clickAndEarnLinks');
        const listener = onValue(linksRef, (snapshot) => {
            const data = snapshot.val();
            setLinks(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
            setIsLoadingLinks(false);
        });
        return () => off(linksRef, 'value', listener);
    }, []);

    const determineButtonState = useCallback(() => {
        if (!user || isLoadingLinks || links.length === 0 || !dailyData) return setButtonState('loading');
        
        if (dailyData.isTargetCompleted) return setButtonState('limit_reached');

        if (buttonState === 'waiting_for_stay' || buttonState === 'post_reward_cooldown') return;
        
        const availableLinks = links.filter(link => {
            const lastClaimed = userClaims[link.id];
            return !lastClaimed || Date.now() - lastClaimed > (24 * 60 * 60 * 1000);
        });
        
        if (availableLinks.length > 0) {
            if (!nextLink || !availableLinks.some(l => l.id === nextLink.id)) {
                setNextLink(availableLinks[Math.floor(Math.random() * availableLinks.length)]);
            }
            setButtonState('ready');
        } else {
            setNextLink(null);
            setButtonState('cooldown_all_used');
        }
    }, [user, isLoadingLinks, links, userClaims, nextLink, dailyData, buttonState]);
    
    useEffect(() => {
        determineButtonState();
    }, [userClaims, links, determineButtonState, dailyData]);

    const handleRewardAndCooldown = (reward: number) => {
        setLastReward(reward);
        setIsRewardDialogOpen(true);
        setTimeout(() => setIsRewardDialogOpen(false), 2500);

        setButtonState('post_reward_cooldown');
        setCooldownTimer(POST_REWARD_COOLDOWN_SECONDS);
        timerRef.current = setInterval(() => {
            setCooldownTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    determineButtonState();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const awardPoints = async (link: ClickAndEarnLink) => {
        if (!user || !dailyData) return;
        try {
            const now = Date.now();
            
            const newClickCount = dailyData.clickCount + 1;
            const targetCompleted = newClickCount >= FIXED_DAILY_TARGET;
            
            let rewardAmount = 0;
            if (targetCompleted && !dailyData.isTargetCompleted) {
                rewardAmount = dailyTargetReward;
            }

            const updates: Record<string, any> = {};
            updates[`users/${user.id}/userClickAndEarnClaims/${link.id}`] = now;
            updates[`users/${user.id}/dailyClickAndEarn/clickCount`] = newClickCount;

            if (targetCompleted && !dailyData.isTargetCompleted) {
                updates[`users/${user.id}/dailyClickAndEarn/isTargetCompleted`] = true;
            }
            
            if (rewardAmount > 0) {
                updates[`users/${user.id}/watchAndEarnPoints`] = (user.watchAndEarnPoints || 0) + rewardAmount;
            }
            await update(ref(database), updates);

            if (rewardAmount > 0) {
                handleRewardAndCooldown(rewardAmount);
            } else {
                setButtonState('post_reward_cooldown');
                 setCooldownTimer(POST_REWARD_COOLDOWN_SECONDS);
                timerRef.current = setInterval(() => {
                    setCooldownTimer(prev => {
                        if (prev <= 1) {
                            clearInterval(timerRef.current!);
                            determineButtonState();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }

        } catch (error: any) {
            toast({ title: "Error", description: "Could not process your claim.", variant: "destructive"});
        }
    };

    const handleButtonClick = () => {
        if (!nextLink) {
            toast({title: "No Task", description: "No available task to start.", variant: "destructive"});
            return;
        }
        window.open(nextLink.url, '_blank', 'noopener,noreferrer');
        adWindowOpenedAt.current = Date.now();
        setButtonState('waiting_for_stay');

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                const timeElapsed = Date.now() - adWindowOpenedAt.current;

                if (timeElapsed < REQUIRED_STAY_SECONDS * 1000) {
                    setIsEarlyReturnDialogOpen(true);
                    determineButtonState();
                } else {
                    awardPoints(nextLink);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
    };

    const canConvert = isConversionDay && userPoints >= 20;

    const handleConvertPoints = async () => {
        if (!canConvert || !user.id) return;
        if (isConverting) return;
        if (pkrPerPoint <= 0) {
            toast({ title: "Conversion Error", description: "Conversion rate not set correctly by admin.", variant: "destructive" });
            return;
        }

        setIsConverting(true);
        const amountToCredit = parseFloat((userPoints * pkrPerPoint).toFixed(2));
        const pointsToDeduct = userPoints;
        
        try {
            if (!database) throw new Error("Firebase not initialized.");

            const userRef = ref(database, `users/${user.id}`);
            await runTransaction(userRef, (currentData: User | null) => {
                if (currentData) {
                    currentData.wallet = (currentData.wallet || 0) + amountToCredit;
                    currentData.watchAndEarnPoints = 0; // Reset points
                }
                return currentData;
            });
            
            const newTx = {
                type: 'watch_earn_conversion', amount: amountToCredit, status: 'completed',
                date: new Date().toISOString(), description: `Converted ${pointsToDeduct.toFixed(4)} points to PKR`,
            };
            await push(ref(database, `walletTransactions/${user.id}`), newTx);
            toast({ title: "Conversion Successful!", description: `You converted ${pointsToDeduct.toFixed(4)} points to Rs ${amountToCredit.toFixed(2)}.`, className: "bg-green-500/20" });

        } catch (error: any) {
            toast({ title: "Conversion Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsConverting(false);
        }
    };
    
    const renderButtonContent = () => {
      switch(buttonState) {
          case 'loading': return <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading Tasks...</>;
          case 'cooldown_all_used': return <><Clock className="mr-2 h-5 w-5"/> All Tasks Done for Today</>;
          case 'limit_reached': return <><Check className="mr-2 h-5 w-5"/> Daily Target Reached</>;
          case 'waiting_for_stay': return <><Clock className="mr-2 h-5 w-5"/> Return after 10s</>;
          case 'post_reward_cooldown': return <><Clock className="mr-2 h-5 w-5"/> Next task in... {cooldownTimer}s</>;
          case 'ready': default: return <><Video className="mr-2 h-5 w-5"/> Watch Ad & Earn</>;
      }
    };

    const isDisabled = buttonState !== 'ready';
    const currentClickCount = dailyData?.clickCount ?? 0;
    const currentClickTarget = dailyData?.dailyClickTarget ?? FIXED_DAILY_TARGET;
    
    return (
        <GlassCard className="p-4 md:p-6 text-center">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                <Gift className="h-7 w-7 text-yellow-400" /> Click &amp; Earn
            </h3>

            <div className="grid grid-cols-2 gap-2 text-center mb-4">
                <div className="p-2 rounded-md bg-muted/40">
                    <p className="text-xs text-muted-foreground">Today's Clicks</p>
                    <p className="font-bold text-lg text-foreground">{currentClickCount} / {currentClickTarget}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                    <p className="text-xs text-muted-foreground">Points Balance</p>
                    <p className="font-bold text-lg text-foreground">{(user.watchAndEarnPoints || 0).toFixed(4)}</p>
                </div>
            </div>

            <Button onClick={handleButtonClick} disabled={isDisabled} className="w-full neon-accent-bg py-4 md:py-6 text-md md:text-lg">
                {renderButtonContent()}
            </Button>
            
            <Separator className="my-6 bg-border/50"/>

            <div className="space-y-3">
                <h4 className="text-lg font-semibold text-foreground">Convert Points</h4>
                 <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                    <p className="text-sm text-muted-foreground">PKR Value of Your Points</p>
                    <p className="text-3xl font-bold text-green-400 flex items-center justify-center gap-1">
                        <RupeeIcon className="h-6"/>
                        {(userPoints * pkrPerPoint).toFixed(2)}
                    </p>
                 </div>
                 
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
                        <DialogTitle className="text-2xl text-yellow-300">Milestone Reached!</DialogTitle>
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
                            Please wait for the full {REQUIRED_STAY_SECONDS} seconds on the ad page to get your reward.
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
