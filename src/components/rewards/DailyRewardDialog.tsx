
"use client";

import { useState } from 'react';
import type { User as AppUserType, GlobalSettings, WalletTransaction } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, CheckCircle2, Loader2, Star } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase/config';
import { ref, update, push, serverTimestamp } from 'firebase/database';
import { generateRewardMessage } from '@/ai/flows/generate-reward-message-flow';


interface DailyRewardDialogProps {
    user: AppUserType;
    settings: NonNullable<GlobalSettings['dailyLoginRewards']>;
    isOpen: boolean;
    onClose: () => void;
}

const isYesterday = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
};

export default function DailyRewardDialog({ user, settings, isOpen, onClose }: DailyRewardDialogProps) {
    const { toast } = useToast();
    const [isClaiming, setIsClaiming] = useState(false);
    
    // --- Improved Streak Logic ---
    const lastClaimDate = user.lastLoginRewardClaim ? new Date(user.lastLoginRewardClaim) : null;
    const lastKnownStreak = user.dailyLoginStreak || 0;

    let dayToClaim: number;
    if (!lastClaimDate) {
        // First claim ever for this user.
        dayToClaim = 1;
    } else if (isYesterday(lastClaimDate)) {
        // Consecutive day claim.
        dayToClaim = (lastKnownStreak % 7) + 1;
    } else {
        // Missed one or more days, streak resets.
        dayToClaim = 1;
    }
    
    // This value is used ONLY for displaying which days are "checked".
    const displayedStreak = lastClaimDate && isYesterday(lastClaimDate) ? lastKnownStreak : 0;
    
    const rewardForToday = settings.rewards[dayToClaim - 1] ?? 0; // Fallback to 0 if settings are misconfigured

    const handleClaim = async () => {
        if (!user.id) return;
        setIsClaiming(true);

        const newStreakToSave = dayToClaim;
        const now = new Date().toISOString();
        const userRef = ref(database, `users/${user.id}`);
        const walletTxRef = ref(database, `walletTransactions/${user.id}`);
        
        try {
            // Prepare updates
            const updates: Record<string, any> = {
                'wallet': (user.wallet || 0) + rewardForToday,
                'dailyLoginStreak': newStreakToSave,
                'lastLoginRewardClaim': now
            };

            await update(userRef, updates);

            // Log the transaction
            const transaction: Omit<WalletTransaction, 'id'> = {
                type: 'daily_login_reward',
                amount: rewardForToday,
                status: 'completed',
                date: now,
                description: `Daily Reward - Day ${newStreakToSave}`,
            };
            await push(walletTxRef, transaction);
            
            // Generate and show AI message
            const aiMessage = await generateRewardMessage({ day: newStreakToSave, amount: rewardForToday });
            toast({
                title: `Day ${newStreakToSave} Reward Claimed!`,
                description: aiMessage.message,
                className: "bg-green-500/20 text-green-300 border-green-500/30",
            });
            onClose();

        } catch (error: any) {
            console.error("Failed to claim daily reward:", error);
            toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="glass-card sm:max-w-lg">
                <DialogHeader>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 mb-4 neon-accent-border">
                        <Gift className="h-8 w-8 text-accent" />
                    </div>
                    <DialogTitle className="text-2xl text-center text-foreground">Daily Login Reward</DialogTitle>
                    <DialogDescription className="text-center">
                        Claim your reward for logging in today! Keep the streak going for a big bonus on Day 7.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3 my-6">
                    {settings.rewards.map((reward, index) => {
                        const dayNumber = index + 1;
                        const isClaimed = dayNumber <= displayedStreak;
                        const isToday = dayNumber === dayToClaim;
                        const isBonus = dayNumber === 7;

                        return (
                            <div
                                key={dayNumber}
                                className={cn(
                                    "p-2 rounded-lg flex flex-col items-center justify-center aspect-square text-center border-2",
                                    isToday ? "border-accent neon-accent-border bg-accent/20 animate-pulse" : "border-border/50 bg-background/50",
                                    isClaimed && "border-green-500/50 bg-green-500/10 opacity-60"
                                )}
                            >
                                <p className="text-xs text-muted-foreground">Day {dayNumber}</p>
                                {isClaimed ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-400 my-1" />
                                ) : (
                                    isBonus ? <Star className="h-6 w-6 text-yellow-400 my-1"/> : <RupeeIcon className="h-6 w-6 my-1" />
                                )}
                                <p className="text-sm font-bold">{reward}</p>
                            </div>
                        );
                    })}
                </div>
                
                <DialogFooter>
                    <Button
                        onClick={handleClaim}
                        disabled={isClaiming}
                        className="w-full neon-accent-bg text-lg py-6"
                    >
                        {isClaiming ? <Loader2 className="animate-spin mr-2" /> : null}
                        Claim Reward for Day {dayToClaim}: <RupeeIcon className="inline h-5 ml-2" /> {rewardForToday}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
