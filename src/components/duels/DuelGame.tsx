
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { playDuelRound } from '@/ai/flows/duel-flow';
import type { DuelRoundOutput } from '@/ai/flows/duel-flow';
import GlassCard from '../core/glass-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import RupeeIcon from '../core/rupee-icon';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Loader2, Swords, ShieldQuestion, Skull, Trophy, BarChart2, AlertCircle, Hand, HandMetal, Scissors } from 'lucide-react';
import Image from 'next/image';
import { database } from '@/lib/firebase/config';
import { ref, runTransaction, push, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { WalletTransaction } from '@/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useAd } from '@/context/AdContext';

type GameState = 'betting' | 'playing' | 'result';
type Action = 'Rock' | 'Paper' | 'Scissors';
interface RoundLog {
    round: number;
    playerMove: Action;
    botMove: Action;
    winner: 'Player' | 'Bot' | 'Draw';
    explanation: string;
}

const actionIcons: Record<Action, React.ElementType> = {
    Rock: HandMetal,
    Paper: Hand,
    Scissors: Scissors,
};

const botUsernames = ["ShadowStriker", "IronPhantom", "CyberGuard", "VoidReaper", "BlitzBot"];

const PlayerAvatar = ({ username, health, maxHealth, isPlayer = false, moveIcon }: { username: string, health: number, maxHealth: number, isPlayer?: boolean, moveIcon?: React.ElementType | null }) => {
    const MoveIcon = moveIcon;
    return (
        <div className="flex flex-col items-center gap-3 w-32 sm:w-40 relative">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                <div className="absolute inset-0 bg-accent/20 rounded-full animate-pulse blur-lg"></div>
                <Image 
                    src={isPlayer ? "https://placehold.co/400x400.png" : "https://placehold.co/400x400.png"} 
                    alt={`${username}'s avatar`} 
                    width={128} 
                    height={128} 
                    className="rounded-full object-cover border-4 shadow-lg bg-background/50"
                    style={{borderColor: isPlayer ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}}
                    data-ai-hint={isPlayer ? "user avatar gaming" : "cyberpunk character"}
                />
                 {MoveIcon && (
                    <div className="absolute -right-2 -bottom-2 sm:-right-4 sm:bottom-0 bg-background p-2 rounded-full border-2 border-accent shadow-lg">
                        <MoveIcon className="h-6 w-6 sm:h-8 sm:w-8 text-accent"/>
                    </div>
                )}
            </div>
            <div className="w-full px-2">
                <Progress value={(health / maxHealth) * 100} className="h-2.5" indicatorClassName={cn(isPlayer ? "bg-primary" : "bg-destructive", "transition-all duration-500 ease-in-out")} />
                <p className="text-xs text-white/80 mt-1 text-center font-bold" style={{textShadow: '1px 1px 2px #000'}}>{health} / {maxHealth} HP</p>
            </div>
            <p className="text-lg font-bold text-white truncate mt-1" style={{textShadow: '1px 1px 3px #000'}}>{username}</p>
        </div>
    );
};


export default function DuelGame() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { triggerButtonAd } = useAd();
    const [gameState, setGameState] = useState<GameState>('betting');
    const [betAmount, setBetAmount] = useState<number>(20);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [playerHealth, setPlayerHealth] = useState(3);
    const [botHealth, setBotHealth] = useState(3);
    const [round, setRound] = useState(1);
    const [matchLog, setMatchLog] = useState<RoundLog[]>([]);
    const [botInfo, setBotInfo] = useState({ username: '' });
    const [isRoundProcessing, setIsRoundProcessing] = useState(false);
    const [gameWinner, setGameWinner] = useState<'Player' | 'Bot' | null>(null);

    const [timer, setTimer] = useState(20);
    const [lastResult, setLastResult] = useState<{ playerMove?: Action, botMove?: Action, explanation: string} | null>(null);

    const [wallet, setWallet] = useState(user?.wallet ?? 0);

    const handlePayout = useCallback(async () => {
        if (!user) return;
        const adminFee = 0.05; // 5%
        const winnings = betAmount * (1 - adminFee);
        const payout = betAmount + winnings; // Bet back + winnings

        try {
            await runTransaction(ref(database, `users/${user.id}/wallet`), (balance) => (balance || 0) + payout);
            await push(ref(database, `walletTransactions/${user.id}`), {
                type: 'duel_win', amount: payout, status: 'completed',
                date: new Date().toISOString(), 
                description: `Winnings (Rs ${winnings.toFixed(2)}) + Bet (Rs ${betAmount.toFixed(2)}) from Duel vs ${botInfo.username}. Admin fee: 5%`,
            } as Omit<WalletTransaction, 'id'>);
        } catch (e) {
            console.error("Failed to process payout:", e);
            toast({ title: "Payout Error", description: "Could not add winnings to your wallet. Please contact support.", variant: "destructive" });
        }
    }, [user, betAmount, botInfo.username, toast]);

    const handlePlayerAction = useCallback(async (playerMove: Action) => {
        if (isRoundProcessing) return;
        setIsRoundProcessing(true);

        try {
            const result = await playDuelRound({ playerMove });
            setLastResult({ playerMove, botMove: result.botMove, explanation: result.explanation });
            
            const newLog: RoundLog = {
                round,
                playerMove,
                botMove: result.botMove,
                winner: result.roundWinner,
                explanation: result.explanation,
            };

            let pHealth = playerHealth;
            let bHealth = botHealth;

            setTimeout(() => { 
                if (result.roundWinner === 'Bot') {
                    pHealth--;
                    setPlayerHealth(pHealth);
                } else if (result.roundWinner === 'Player') {
                    bHealth--;
                    setBotHealth(bHealth);
                }
                setMatchLog(prev => [newLog, ...prev]);

                if (pHealth <= 0) {
                    setGameWinner('Bot');
                    setGameState('result');
                } else if (bHealth <= 0) {
                    setGameWinner('Player');
                    handlePayout();
                    setGameState('result');
                } else {
                    setRound(prev => prev + 1);
                    setTimer(20);
                    setIsRoundProcessing(false);
                }
            }, 1500); 

        } catch (e: any) {
            toast({ title: "Round Error", description: e.message, variant: "destructive" });
            setIsRoundProcessing(false);
        }
    }, [isRoundProcessing, round, playerHealth, botHealth, toast, handlePayout]);


    useEffect(() => {
        if (!user || !database) return;
        const userWalletRef = ref(database, `users/${user.id}/wallet`);
        const unsubscribe = onValue(userWalletRef, (snapshot) => {
            setWallet(snapshot.val() ?? 0);
        });
        return () => unsubscribe();
    }, [user]);
    
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (gameState === 'playing' && !isRoundProcessing) {
            interval = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(interval!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [gameState, isRoundProcessing, round]);

    const selectRandomMoveAndPlay = useCallback(() => {
        const moves: Action[] = ['Rock', 'Paper', 'Scissors'];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        toast({
            title: "Time's Up!",
            description: `A random move (${randomMove}) was selected for you.`,
        });
        handlePlayerAction(randomMove);
    }, [handlePlayerAction, toast]);

    useEffect(() => {
        if (timer === 0 && gameState === 'playing' && !isRoundProcessing) {
            selectRandomMoveAndPlay();
        }
    }, [timer, gameState, isRoundProcessing, selectRandomMoveAndPlay]);

    const minBet = 20;
    const maxBet = useMemo(() => Math.max(minBet, Math.floor(wallet)), [wallet, minBet]);

    const handleSliderChange = (value: number[]) => setBetAmount(value[0]);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBetAmount(e.target.value === '' ? 0 : parseInt(e.target.value, 10));
    };
    const handleInputBlur = () => {
        if (betAmount < minBet) {
            toast({ title: `Minimum bet is Rs ${minBet}`, variant: "destructive" });
            setBetAmount(minBet);
        } else if (betAmount > maxBet) {
            toast({ title: `Maximum bet is Rs ${maxBet}`, variant: "destructive" });
            setBetAmount(maxBet);
        }
    };
    
    const handleFindMatch = async () => {
        if (!user) { setError("You must be logged in to play."); return; }
        if (betAmount < minBet) { setError(`Bet amount must be at least Rs ${minBet}.`); return; }
        if (wallet < betAmount) { setError("Insufficient balance for this bet."); return; }

        setIsProcessing(true);
        setError(null);
        
        try {
            const userWalletRef = ref(database, `users/${user.id}/wallet`);
            const txResult = await runTransaction(userWalletRef, (currentBalance) => {
                if ((currentBalance || 0) < betAmount) return;
                return (currentBalance || 0) - betAmount;
            });

            if (!txResult.committed) throw new Error("Insufficient funds. Your balance may have been updated.");

            await push(ref(database, `walletTransactions/${user.id}`), {
                type: 'duel_bet', amount: -betAmount, status: 'on_hold',
                date: new Date().toISOString(), description: `Bet for 1v1 Duel`,
            } as Omit<WalletTransaction, 'id'>);
            
            setPlayerHealth(3);
            setBotHealth(3);
            setRound(1);
            setMatchLog([]);
            setGameWinner(null);
            setLastResult(null);
            setTimer(20);
            const randomBotIndex = Math.floor(Math.random() * botUsernames.length);
            setBotInfo({
                username: botUsernames[randomBotIndex],
            });
            setGameState('playing');

        } catch (e: any) {
            setError(e.message || "Could not start the duel. Your wallet has not been charged.");
        } finally {
            setIsProcessing(false);
        }
    };

    const resetGame = () => {
        setGameState('betting');
        setError(null);
    };

    if (authLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-accent"/></div>;
    
    if (!user) return (
        <GlassCard className="p-8 text-center">
            <Alert variant="destructive">
                <ShieldQuestion className="h-4 w-4" />
                <AlertTitle>Login Required</AlertTitle>
                <AlertDescription><p className="mb-4">You need to be logged in to participate in Duels.</p><Button asChild><Link href="/auth/login">Login or Sign Up</Link></Button></AlertDescription>
            </Alert>
        </GlassCard>
    );
    
    if (wallet < 20) return (
        <GlassCard className="p-8 text-center">
            <Alert><BarChart2 className="h-4 w-4" /><AlertTitle>Minimum Balance Required</AlertTitle><AlertDescription><p className="mb-4">You need a balance of at least Rs 20 to play Duels.</p><Button asChild><Link href="/wallet">Go to Wallet</Link></Button></AlertDescription></Alert>
        </GlassCard>
    );

    return (
        <>
            {gameState === 'betting' && (
                <GlassCard className="p-6 md:p-8 max-w-lg mx-auto bg-background/80 border-border/50 shadow-2xl">
                    <div className="space-y-6 text-center">
                        <h3 className="text-2xl font-bold text-foreground">Set Your Wager</h3>
                        <p className="text-muted-foreground">Slide or type to set the amount for this duel.</p>
                        
                        <div className="text-center flex items-center justify-center gap-2 my-4">
                            <span className="text-5xl md:text-6xl font-bold text-accent neon-accent-text flex items-baseline">
                                <RupeeIcon className="inline h-8 -mr-1" />
                                <Input 
                                    type="number" 
                                    value={betAmount === 0 && !isProcessing ? '' : betAmount} 
                                    onChange={handleInputChange} 
                                    onBlur={handleInputBlur} 
                                    className="w-48 h-auto p-0 text-5xl md:text-6xl font-bold text-accent bg-transparent border-0 text-center focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    disabled={isProcessing} 
                                />
                            </span>
                        </div>

                        <div className="px-4">
                            <Slider 
                                value={[betAmount]} 
                                onValueChange={handleSliderChange} 
                                min={minBet} 
                                max={maxBet} 
                                step={1} 
                                disabled={isProcessing} 
                                className="[&>span:first-of-type]:h-3 [&>span:first-of-type>span]:h-3"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>Min: Rs {minBet}</span>
                                <span>Max: Rs {maxBet}</span>
                            </div>
                        </div>

                        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/> <AlertDescription>{error}</AlertDescription></Alert>}
                        
                        <Button 
                            onClick={() => triggerButtonAd(handleFindMatch, 'duel_find_match')} 
                            className="w-full text-lg py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105" 
                            disabled={isProcessing}>
                            <Swords className="mr-2"/>Place Bet & Find Match
                        </Button>
                    </div>
                </GlassCard>
            )}

            {gameState === 'playing' && (
                <div 
                    className="flex flex-col items-center justify-between min-h-[70vh] p-4 bg-background rounded-lg" 
                    style={{background: 'radial-gradient(ellipse at bottom, hsl(var(--primary)) 0%, hsl(var(--background)) 60%)'}}
                >
                    <PlayerAvatar username={botInfo.username} health={botHealth} maxHealth={3} moveIcon={lastResult?.botMove ? actionIcons[lastResult.botMove] : null}/>
                    
                    <div className="text-center my-4 py-2 min-h-[100px] flex flex-col justify-center">
                        {isRoundProcessing && lastResult ? (
                            <>
                                <p className="text-xl font-semibold text-white mt-2">{lastResult.explanation}</p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-4xl font-bold text-white/90 neon-accent-text tracking-widest">ROUND {round}</h4>
                                <p className="font-bold text-6xl text-white/50" style={{textShadow: "0 0 10px hsl(var(--accent))"}}>VS</p>
                            </>
                        )}
                    </div>
                    
                    <div className="w-full max-w-lg text-center space-y-4">
                        <div className="mb-4">
                            <div 
                                className="font-mono font-bold text-7xl text-white tabular-nums"
                                style={{ textShadow: "0 0 5px hsl(var(--accent)), 0 0 15px hsl(var(--accent)), 0 0 30px hsl(var(--accent))" }}
                            >
                                {String(timer).padStart(2, '0')}
                            </div>
                            <p className="text-sm font-semibold tracking-widest text-accent/80">SECONDS</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {(['Rock', 'Paper', 'Scissors'] as Action[]).map(action => {
                                const Icon = actionIcons[action];
                                return (
                                    <Button key={action} variant="outline" className="flex flex-col h-auto p-4 gap-2 border-2 border-accent/50 bg-black/50 text-accent hover:bg-accent/20 hover:border-accent" onClick={() => handlePlayerAction(action)} disabled={isRoundProcessing}>
                                        <Icon className="h-10 w-10" />
                                        <span className="font-semibold">{action}</span>
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                     <PlayerAvatar username={user.username} health={playerHealth} maxHealth={3} isPlayer moveIcon={lastResult?.playerMove ? actionIcons[lastResult.playerMove] : null}/>
                </div>
            )}

            {gameState === 'result' && (
                <GlassCard className="text-center space-y-4 flex flex-col items-center min-h-[400px] justify-center p-8">
                    {gameWinner === 'Player' ? (
                        <>
                            <Trophy className="h-20 w-20 text-yellow-400" />
                            <h2 className="text-4xl font-extrabold text-yellow-400">You Won!</h2>
                            <p className="text-lg text-foreground">You defeated {botInfo.username} and won <RupeeIcon className="inline h-5" /><span className="font-bold">{(betAmount + betAmount * (1 - 0.05)).toFixed(2)}</span>!</p>
                        </>
                    ) : (
                        <>
                            <Skull className="h-20 w-20 text-destructive" />
                            <h2 className="text-4xl font-extrabold text-destructive">You Lost</h2>
                            <p className="text-lg text-foreground">You were defeated by {botInfo.username}.</p>
                        </>
                    )}
                    <p className="text-sm text-muted-foreground">(Admin fee of 5% applied on winnings)</p>
                    <Button onClick={resetGame} className="w-full max-w-xs text-lg py-6" variant="outline">Play Again</Button>
                </GlassCard>
            )}
        </>
    );
}
