
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { playSpinWheel } from '@/ai/flows/spin-wheel-flow';
import GlassCard from '../core/glass-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import RupeeIcon from '../core/rupee-icon';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Loader2, Skull, Trophy, BarChart2, AlertCircle, Disc, Coins } from 'lucide-react';
import { database } from '@/lib/firebase/config';
import { ref, runTransaction, push, onValue, get, serverTimestamp } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { WalletTransaction, GlobalSettings, TokenTransaction } from '@/types';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useAd } from '@/context/AdContext';

type GameState = 'betting' | 'spinning' | 'result';
type Segment = { multiplier: number, label: string, color: string, weight?: number };
type Currency = 'pkr' | 'token';

const defaultSegments: Segment[] = [
  { multiplier: 2, label: "2x", color: "hsl(220, 80%, 60%)" },
  { multiplier: 0, label: "0x", color: "hsl(0, 80%, 60%)" },
  { multiplier: 1.5, label: "1.5x", color: "hsl(140, 80%, 60%)" },
  { multiplier: 0.5, label: "0.5x", color: "hsl(60, 80%, 60%)" },
  { multiplier: 5, label: "5x", color: "hsl(280, 80%, 60%)" },
  { multiplier: 0, label: "0x", color: "hsl(0, 80%, 60%)" },
  { multiplier: 1, label: "1x", color: "hsl(180, 80%, 60%)" },
  { multiplier: 0.5, label: "0.5x", color: "hsl(60, 80%, 60%)" },
];


export default function SpinWheelGame() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { triggerButtonAd } = useAd();
  const [gameState, setGameState] = useState<GameState>('betting');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [wallet, setWallet] = useState(user?.wallet ?? 0);
  const [tokenWallet, setTokenWallet] = useState(user?.tokenWallet ?? 0);
  const [tokenSettings, setTokenSettings] = useState<GlobalSettings['tokenSettings'] | null>(null);

  const [resultData, setResultData] = useState<{ multiplier: number; prizeAmount: number; winningLabel: string; } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(5000);
  const [segments, setSegments] = useState<Segment[]>(defaultSegments);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  const [currency, setCurrency] = useState<Currency>('pkr');
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!database) {
      setIsLoadingSettings(false);
      return;
    }
    const settingsRef = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val() as GlobalSettings;
        if (settings && settings.spinWheelSettings?.segments && settings.spinWheelSettings.segments.length >= 2) {
          setSegments(settings.spinWheelSettings.segments);
        }
        setTokenSettings(settings.tokenSettings || null);
      }
      setIsLoadingSettings(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !database) return;
    const userRef = ref(database, `users/${user.id}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        setWallet(data?.wallet ?? 0);
        setTokenWallet(data?.tokenWallet ?? 0);
    });
    return () => unsubscribe();
  }, [user]);

  const minBet = 10;
  const maxBet = useMemo(() => {
      const balance = currency === 'pkr' ? wallet : tokenWallet;
      return Math.max(minBet, Math.floor(balance));
  }, [wallet, tokenWallet, currency, minBet]);


  const handleSliderChange = (value: number[]) => setBetAmount(value[0]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBetAmount(e.target.value === '' ? 0 : parseInt(e.target.value, 10));
  };
  const handleInputBlur = () => {
    if (betAmount < minBet) {
      toast({ title: `Minimum bet is ${minBet} ${currency.toUpperCase()}`, variant: "destructive" });
      setBetAmount(minBet);
    } else if (betAmount > maxBet) {
      toast({ title: `Maximum bet is ${maxBet} ${currency.toUpperCase()}`, variant: "destructive" });
      setBetAmount(maxBet);
    }
  };

  const handleSpin = async () => {
    if (!user) { setError("You must be logged in to play."); return; }
    if (betAmount < minBet) { setError(`Bet amount must be at least ${minBet}.`); return; }

    const hasSufficientBalance = currency === 'pkr' ? wallet >= betAmount : tokenWallet >= betAmount;
    if (!hasSufficientBalance) { setError(`Insufficient ${currency.toUpperCase()} balance for this bet.`); return; }

    setIsProcessing(true);
    setError(null);
    setResultData(null);

    let txCommitted = false;
    const userWalletRef = ref(database, `users/${user.id}/${currency === 'pkr' ? 'wallet' : 'tokenWallet'}`);

    try {
      const txResult = await runTransaction(userWalletRef, (currentBalance) => {
        if ((currentBalance || 0) < betAmount) return; // Abort
        return (currentBalance || 0) - betAmount;
      });

      if (!txResult.committed) throw new Error("Insufficient funds. Your balance may have been updated.");
      txCommitted = true;
      
      const { multiplier, prizeAmount, segmentIndex, winningLabel, segments: authoritativeSegments } = await playSpinWheel({ betAmount, currency });
      
      setSegments(authoritativeSegments);

      const wheel = wheelRef.current;
      if (!wheel) throw new Error("Wheel element not found.");
      
      const handleTransitionEnd = async () => {
        try {
            if (prizeAmount > 0) {
                await runTransaction(userWalletRef, (currentBalance) => (currentBalance || 0) + prizeAmount);
            }

            const transactionDescription = `Spin Wheel Bet: ${betAmount} ${currency.toUpperCase()}, Won: ${prizeAmount} ${currency.toUpperCase()} (${multiplier}x)`;
            
            if (currency === 'pkr') {
                await push(ref(database, `walletTransactions/${user.id}`), {
                    type: 'spin_wheel_result',
                    amount: prizeAmount - betAmount,
                    status: 'completed',
                    date: new Date().toISOString(),
                    description: transactionDescription,
                } as Omit<WalletTransaction, 'id'>);
            } else {
                await push(ref(database, `tokenTransactions/${user.id}`), {
                    type: 'spin_wheel_bet',
                    amount: -betAmount,
                    description: `Spin Wheel Bet`,
                    date: serverTimestamp(),
                } as Omit<TokenTransaction, 'id'>);
                if (prizeAmount > 0) {
                    await push(ref(database, `tokenTransactions/${user.id}`), {
                        type: 'spin_wheel_win',
                        amount: prizeAmount,
                        description: `Spin Wheel Winnings (${multiplier}x)`,
                        date: serverTimestamp(),
                    } as Omit<TokenTransaction, 'id'>);
                }
            }
            
            setResultData({ multiplier, prizeAmount, winningLabel });
            setGameState('result');
        } catch(payoutError: any) {
            console.error("Payout error:", payoutError);
            toast({ title: "Payout Error", description: "Failed to credit winnings. Please contact support.", variant: "destructive"});
            setGameState('betting');
        } finally {
            setIsProcessing(false);
            wheel.removeEventListener('transitionend', handleTransitionEnd);
        }
      };
      
      wheel.addEventListener('transitionend', handleTransitionEnd, { once: true });
      
      const randomDuration = Math.floor(Math.random() * 5001) + 10000;
      setSpinDuration(randomDuration);
      setGameState('spinning');
      
      const totalSegments = authoritativeSegments.length;
      const segmentDegrees = 360 / totalSegments;
      
      // The pointer is at 270 degrees (top). The center of the winning segment must align with it.
      const centerOfWinningSegment = (segmentIndex * segmentDegrees) + (segmentDegrees / 2);
      const rotationToDo = 270 - centerOfWinningSegment;
      
      const currentRevolutions = Math.floor(rotation / 360);
      const newRotation = ((currentRevolutions + 15) * 360) + rotationToDo;
      
      setRotation(newRotation);

    } catch (e: any) {
        if(txCommitted){
             await runTransaction(userWalletRef, (currentBalance) => (currentBalance || 0) + betAmount);
             toast({ title: "Spin Error", description: "An error occurred, your bet has been refunded.", variant: "destructive" });
        } else {
             setError(e.message || "Could not start the game. Your wallet has not been charged.");
        }
      setGameState('betting');
      setIsProcessing(false);
    }
  };

  const resetGame = () => {
    setGameState('betting');
    setError(null);
    setBetAmount(10);
  };
  
  if (authLoading || isLoadingSettings) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-accent"/></div>;
  if (wallet < 10 && (tokenSettings?.enabled ? tokenWallet < 10 : true)) return (
    <GlassCard className="p-8 text-center"><Alert><BarChart2 className="h-4 w-4" /><AlertTitle>Minimum Balance Required</AlertTitle><AlertDescription><p className="mb-4">You need a balance of at least 10 in any currency to play.</p><Button asChild><Link href="/wallet">Go to Wallet</Link></Button></AlertDescription></Alert></GlassCard>
  );

  const segmentDegrees = 360 / segments.length;
  const gradientStyle = `conic-gradient(${segments.map((s, i) => `${s.color} ${i * segmentDegrees}deg, ${s.color} ${(i + 1) * segmentDegrees}deg`).join(', ')})`;

  return (
    <>
      <GlassCard className="max-w-xl mx-auto p-6 text-center">
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto mb-8 flex items-center justify-center">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
                <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-accent"></div>
            </div>
            <div 
                ref={wheelRef}
                className="relative w-full h-full rounded-full border-8 border-background/50 shadow-2xl transition-transform ease-[cubic-bezier(0.33, 1, 0.68, 1)]"
                style={{ 
                    background: gradientStyle,
                    transform: `rotate(${rotation}deg)`,
                    transitionDuration: `${spinDuration}ms`,
                }}
            >
                {segments.map((segment, i) => (
                    <div 
                        key={i} 
                        className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left flex items-center justify-center"
                        style={{ transform: `rotate(${i * segmentDegrees + (segmentDegrees / 2)}deg)` }}
                    >
                        <span className="font-bold text-white text-lg sm:text-xl -rotate-90" style={{ textShadow: '1px 1px 2px #000' }}>{segment.label}</span>
                    </div>
                ))}
            </div>
             <div className="absolute w-16 h-16 bg-background/50 rounded-full border-4 border-border shadow-inner backdrop-blur-sm"></div>
             <div className="absolute w-6 h-6 bg-muted rounded-full border-2 border-border shadow-md"></div>
        </div>

        {gameState !== 'result' ? (
             <div className="space-y-6">
                <h3 className="text-2xl font-bold text-foreground">
                  {gameState === 'spinning' ? 'Spinning...' : 'Set Your Bet'}
                </h3>
                
                <RadioGroup defaultValue="pkr" onValueChange={(value) => setCurrency(value as Currency)} className="flex justify-center gap-4 my-4" disabled={isProcessing}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pkr" id="pkr" disabled={isProcessing || gameState === 'spinning'}/>
                    <Label htmlFor="pkr">PKR</Label>
                  </div>
                  {tokenSettings?.enabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="token" id="token" disabled={isProcessing || gameState === 'spinning'}/>
                      <Label htmlFor="token">{tokenSettings.tokenSymbol || 'Token'}</Label>
                    </div>
                  )}
                </RadioGroup>

                <div className="text-5xl font-bold text-accent flex items-center justify-center">
                    {currency === 'pkr' ? <RupeeIcon className="inline h-10 -mt-2"/> : <Coins className="inline h-10 -mt-2 mr-1" />}
                    {betAmount}
                </div>
                <Slider value={[betAmount]} onValueChange={handleSliderChange} min={minBet} max={maxBet} step={1} disabled={isProcessing || gameState === 'spinning'} />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <p>Min: {minBet} {currency.toUpperCase()}</p>
                    <p>Max: {maxBet} {currency.toUpperCase()}</p>
                </div>
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/> <AlertDescription>{error}</AlertDescription></Alert>}
                <Button 
                    onClick={() => triggerButtonAd(handleSpin, 'spin_wheel_spin')} 
                    className="w-full text-lg py-6 neon-accent-bg" 
                    disabled={isProcessing || gameState === 'spinning' || isLoadingSettings}
                >
                  {gameState === 'spinning' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Disc className="mr-2 h-5 w-5"/>}
                  {gameState === 'spinning' ? 'Spinning...' : isLoadingSettings ? 'Loading...' : 'Place Bet & Spin'}
                </Button>
            </div>
        ) : (
             resultData && (
                <div className="space-y-4">
                    {resultData.multiplier > 1 ? (
                        <>
                            <Trophy className="mx-auto h-12 w-12 text-yellow-400" />
                            <h3 className="text-3xl font-bold text-yellow-400">You Won!</h3>
                            <p className="text-lg text-foreground">The wheel landed on <span className="font-bold text-accent">{resultData.winningLabel}</span>. You won {resultData.prizeAmount.toFixed(2)} {currency.toUpperCase()}!</p>
                        </>
                    ) : resultData.multiplier === 1 ? (
                         <>
                            <Disc className="mx-auto h-12 w-12 text-blue-400" />
                            <h3 className="text-3xl font-bold text-blue-400">Bet Returned!</h3>
                            <p className="text-lg text-foreground">The wheel landed on <span className="font-bold text-accent">{resultData.winningLabel}</span>. Your bet of {betAmount} {currency.toUpperCase()} was returned.</p>
                        </>
                    ) : resultData.multiplier > 0 ? (
                        <>
                            <BarChart2 className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="text-3xl font-bold text-foreground">Partial Return!</h3>
                            <p className="text-lg text-foreground">The wheel landed on <span className="font-bold text-accent">{resultData.winningLabel}</span>. You received {resultData.prizeAmount.toFixed(2)} {currency.toUpperCase()} back.</p>
                        </>
                    ) : ( // multiplier is 0
                        <>
                            <Skull className="mx-auto h-12 w-12 text-destructive" />
                            <h3 className="text-3xl font-bold text-destructive">Better Luck Next Time!</h3>
                            <p className="text-lg text-foreground">The wheel landed on <span className="font-bold text-accent">{resultData.winningLabel}</span>. You lost your bet of {betAmount} {currency.toUpperCase()}.</p>
                        </>
                    )}
                    <Button onClick={resetGame} variant="outline" className="w-full text-lg py-6">Play Again</Button>
                </div>
            )
        )}
      </GlassCard>
    </>
  );
}
