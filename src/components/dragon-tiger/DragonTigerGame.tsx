
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { playDragonTigerRound } from '@/ai/flows/dragon-tiger-flow';
import type { DragonTigerBetType } from '@/ai/flows/dragon-tiger-flow';
import { Button } from '../ui/button';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Loader2, Swords, ShieldQuestion, UserCircle, Crown, Info, Users as UsersIcon, Star } from 'lucide-react';
import Image from 'next/image';
import { database } from '@/lib/firebase/config';
import { ref, runTransaction, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { GlobalSettings } from '@/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { getDisplayableBannerUrl, generateDataAiHint } from '@/lib/image-helper';
import RupeeIcon from '../core/rupee-icon';

// --- Card Assets Helper ---
const getCardImagePath = (cardKey: string | undefined): string => {
    if (!cardKey) return '/cards/card_back.svg'; // Fallback for safety
    return `/cards/${cardKey}.svg`;
};

// --- Styled Component for Card Back Placeholder ---
const CardBack = () => (
    <div className="w-24 h-36 bg-gradient-to-br from-blue-800 to-indigo-900 border-2 border-blue-500/50 rounded-lg flex items-center justify-center shadow-lg p-1.5">
        <div className="w-full h-full border border-blue-400/50 rounded-md flex items-center justify-center">
            <Swords className="h-10 w-10 text-blue-300 opacity-40" />
        </div>
    </div>
);

const chipColors = [
    'bg-blue-600 border-blue-400 text-blue-100',
    'bg-red-600 border-red-400 text-red-100',
    'bg-purple-600 border-purple-400 text-purple-100',
    'bg-yellow-600 border-yellow-400 text-yellow-100',
    'bg-green-600 border-green-400 text-green-100',
    'bg-pink-600 border-pink-400 text-pink-100',
    'bg-orange-600 border-orange-400 text-orange-100',
    'bg-teal-600 border-teal-400 text-teal-100',
];

const Chip = ({ value, isSelected, onSelect, disabled, colorClass }: { value: number, isSelected: boolean, onSelect: () => void, disabled?: boolean, colorClass: string }) => {
    const displayValue = value >= 1000 ? `${value / 1000}K` : value;
    return (
        <button onClick={onSelect} disabled={disabled} className={cn(
            "w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex-shrink-0 flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-200 shadow-md",
            colorClass,
            isSelected ? 'scale-110 ring-4 ring-offset-2 ring-offset-background ring-white' : 'hover:scale-105',
            disabled && 'opacity-50 cursor-not-allowed'
        )}>
            {displayValue}
        </button>
    );
};


type GameState = 'betting' | 'dealing' | 'result';
interface Card { value: string; suit: string; key: string; }
interface BotPlayer { id: string; username: string; balance: number; avatar: string; }

const botUsernames = ["Shadow", "Rogue", "Viper", "Ghost", "Ace", "Blaze", "Fury", "Reaper", "Specter", "Titan", "Wolf", "Cobra", "Venom", "Wraith", "Storm", "Phoenix", "Raptor", "Slayer", "Hunter", "Maverick"];

const createBotPool = (): BotPlayer[] => botUsernames.map((name, i) => ({
    id: `bot_${i}`, username: `${name}${Math.floor(10 + Math.random() * 90)}`,
    balance: Math.floor(Math.random() * 150000) + 5000,
    avatar: `https://placehold.co/100x100.png?text=${name.charAt(0)}`
}));

const formatBalance = (balance: number): string => {
    if (balance >= 1000000) return `Rs ${(balance / 1000000).toFixed(1)}M`;
    if (balance >= 1000) return `Rs ${(balance / 1000).toFixed(1)}K`;
    return `Rs ${balance.toFixed(0)}`;
};

const PlayerInfo = ({ player }: { player: BotPlayer }) => (
    <div className="flex flex-col items-center gap-1 text-center w-12 sm:w-16">
        <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-yellow-700 bg-black/50 flex items-center justify-center font-bold text-white text-xl overflow-hidden">
                 <Image src={player.avatar} alt={player.username} width={40} height={40} className="object-cover" />
            </div>
            <Crown className="absolute -top-1 left-1/2 -translate-x-1/2 h-4 w-4 text-yellow-500" />
        </div>
        <p className="text-[9px] sm:text-[10px] font-semibold text-white truncate w-full">{player.username}</p>
        <p className="text-[9px] sm:text-[10px] font-bold text-yellow-300">{formatBalance(player.balance)}</p>
    </div>
);

const BettingArea = ({ type, userBet, botBet, onBet, disabled }: { type: DragonTigerBetType, userBet: number, botBet: number, onBet: () => void, disabled?: boolean }) => {
    const typeClasses = {
        Dragon: { border: 'border-blue-500', shadow: 'shadow-blue-500/50', text: 'text-blue-300' },
        Tiger: { border: 'border-red-500', shadow: 'shadow-red-500/50', text: 'text-red-300' },
        Tie: { border: 'border-green-500', shadow: 'shadow-green-500/50', text: 'text-green-300' }
    };
    return (
        <div onClick={disabled ? undefined : onBet} className={cn("relative h-full rounded-xl border-2 bg-black/30 flex flex-col items-center justify-center p-2 sm:p-4 cursor-pointer transition-all duration-300 hover:bg-black/50 shadow-lg", typeClasses[type].border, disabled && "cursor-not-allowed opacity-60", userBet > 0 && `ring-4 ${typeClasses[type].border}`)}>
             <AnimatePresence>
                {botBet > 0 && (
                     <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="absolute -top-2 left-1/2 -translate-x-1/2 min-w-[60px] text-center px-2 py-0.5 sm:px-3 sm:py-1 bg-gray-800/60 border border-gray-500/50 rounded-full text-white font-bold text-xs sm:text-base flex items-center gap-1.5">
                        <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        {botBet.toLocaleString()}
                    </motion.div>
                )}
            </AnimatePresence>
            <h3 className={cn("text-xl sm:text-4xl font-extrabold text-white uppercase tracking-widest", typeClasses[type].text)} style={{ textShadow: '0 0 10px currentColor' }}>{type}</h3>
            <p className="text-xs sm:text-sm text-yellow-300 font-semibold">{type === 'Tie' ? `8 to 1` : `1 to 1`}</p>
            <AnimatePresence>
                {userBet > 0 && (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="absolute -bottom-2 sm:bottom-2 left-1/2 -translate-x-1/2 min-w-[60px] text-center px-2 py-0.5 sm:px-3 sm:py-1 bg-black/60 border border-white/30 rounded-full text-white font-bold text-sm sm:text-lg">
                        {userBet.toLocaleString()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const DEFAULT_ROUND_TIMER = 15;
const defaultChips = [20, 100, 200, 1000, 2000];

const congratulatoryWords = ["YOU WIN!", "VICTORY!", "JACKPOT!", "BIG WIN!", "NICE ONE!"];

export default function DragonTigerGame() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [gameState, setGameState] = useState<GameState>('betting');
    const [settings, setSettings] = useState<GlobalSettings['dragonTigerSettings'] | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [wallet, setWallet] = useState(user?.wallet ?? 0);
    const [error, setError] = useState<string | null>(null);

    const [bets, setBets] = useState<{ [key in DragonTigerBetType]: number }>({ Dragon: 0, Tiger: 0, Tie: 0 });
    const [botBets, setBotBets] = useState<{ [key in DragonTigerBetType]: number }>({ Dragon: 0, Tiger: 0, Tie: 0 });
    const [currentBotActions, setCurrentBotActions] = useState<Record<string, { type: DragonTigerBetType, amount: number }>>({});
    const [selectedChip, setSelectedChip] = useState<number>(20);
    const [roundResult, setRoundResult] = useState<{ dragonCard: Card, tigerCard: Card, winner: 'Dragon' | 'Tiger' | 'Tie', payout: number, winnings: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [timer, setTimer] = useState(DEFAULT_ROUND_TIMER);
    
    const [botPool, setBotPool] = useState<BotPlayer[]>(createBotPool());
    const [displayedBots, setDisplayedBots] = useState<BotPlayer[]>([]);
    const congratsWordRef = useRef("YOU WIN!");
    
    const chipValues = useMemo(() => {
        return settings?.chips && settings.chips.length > 0
            ? settings.chips.map(c => c.value).sort((a,b) => a - b)
            : defaultChips;
    }, [settings]);

    const startNewBettingRound = useCallback(() => {
        setGameState('betting');
        setBets({ Dragon: 0, Tiger: 0, Tie: 0 });
        setBotBets({ Dragon: 0, Tiger: 0, Tie: 0 });
        setRoundResult(null);
        setTimer(settings?.roundTimer || DEFAULT_ROUND_TIMER);
        setIsProcessing(false);
        setError(null);
        
        setBotPool(currentPool => {
            const shuffled = [...currentPool].sort(() => 0.5 - Math.random());
            const newDisplayedBots = shuffled.slice(0, 6);
            setDisplayedBots(newDisplayedBots);
    
            const botActions: Record<string, { type: DragonTigerBetType, amount: number }> = {};
            newDisplayedBots.forEach(bot => {
                if (Math.random() < 0.85) {
                    const betPercentage = 0.005 + Math.random() * 0.045;
                    let betAmount = Math.floor(bot.balance * betPercentage);
                    betAmount = Math.max(50, Math.min(betAmount, 5000));
    
                    const betChoiceRand = Math.random();
                    let betType: DragonTigerBetType;
    
                    if (betChoiceRand < 0.47) {
                        betType = 'Dragon';
                    } else if (betChoiceRand < 0.94) {
                        betType = 'Tiger';
                    } else {
                        betType = 'Tie';
                    }
                    
                    botActions[bot.id] = { type: betType, amount: betAmount };
                }
            });
            setCurrentBotActions(botActions);

            return currentPool;
        })
    }, [settings]);
    
    useEffect(() => {
        if (!isLoadingSettings && botPool.length > 0) {
            startNewBettingRound();
        }
    }, [isLoadingSettings, botPool.length, startNewBettingRound]);

    useEffect(() => {
        if (!database) { setIsLoadingSettings(false); return; }
        const settingsRef = ref(database, 'globalSettings/dragonTigerSettings');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const fetchedSettings = snapshot.val();
                setSettings(fetchedSettings);
                // Set default chip if it's not in the new list
                if (fetchedSettings?.chips && fetchedSettings.chips.length > 0) {
                    const values = fetchedSettings.chips.map((c: any) => c.value);
                    if (!values.includes(selectedChip)) {
                        setSelectedChip(values[0]);
                    }
                }
            }
            setIsLoadingSettings(false);
        });
        return () => unsubscribe();
    }, [selectedChip]);

    useEffect(() => {
        if (!user || !database) return;
        const userWalletRef = ref(database, `users/${user.id}/wallet`);
        const unsubscribe = onValue(userWalletRef, (snapshot) => setWallet(snapshot.val() ?? 0));
        return () => unsubscribe();
    }, [user]);

    const totalUserBet = useMemo(() => Object.values(bets).reduce((acc, amount) => acc + amount, 0), [bets]);

    const handleClearBet = () => {
        if (gameState !== 'betting') return;
        setBets({ Dragon: 0, Tiger: 0, Tie: 0 });
    };

    const handlePlaceBet = (betType: DragonTigerBetType) => {
        if (gameState !== 'betting' || isProcessing) return;

        if (totalUserBet > 0) {
            toast({
                title: "Bet Already Placed",
                description: "You can only place one bet per round. Clear your bet to change it.",
                variant: "destructive"
            });
            return;
        }

        if (wallet < selectedChip) {
            toast({ title: "Insufficient Funds", description: "You don't have enough balance for this bet.", variant: "destructive" });
            return;
        }

        setBets({
            Dragon: 0,
            Tiger: 0,
            Tie: 0,
            [betType]: selectedChip
        });
    };
    
    const handlePlayRound = useCallback(async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setError(null);
        
        try {
            if (totalUserBet > 0 && user) {
                const txResult = await runTransaction(ref(database, `users/${user.id}/wallet`), (balance) => {
                    if ((balance || 0) < totalUserBet) return; // Abort
                    return (balance || 0) - totalUserBet;
                });
                if (!txResult.committed) throw new Error("Insufficient funds. Your balance may have changed.");
            }

            setGameState('dealing');
            const result = await playDragonTigerRound({ bets });
            
            setBotPool(currentPool => {
                const newBotPool = [...currentPool];
                displayedBots.forEach(bot => {
                    const botAction = currentBotActions[bot.id];
                    if (botAction) {
                        const botIndex = newBotPool.findIndex(p => p.id === bot.id);
                        if (botIndex !== -1) {
                            let winnings = -botAction.amount;
                            if (botAction.type === result.winner) {
                                winnings += botAction.amount * ((result.winner === 'Tie' ? (settings?.tieTotalReturnMultiplier || 8) : 1) + 1);
                            } else if (result.winner === 'Tie' && (botAction.type === 'Dragon' || botAction.type === 'Tiger')) {
                                winnings += botAction.amount;
                            }
                            newBotPool[botIndex].balance += winnings;
                            newBotPool[botIndex].balance = Math.max(0, newBotPool[botIndex].balance);
                        }
                    }
                });
                return newBotPool;
            });
            
            if (totalUserBet > 0 && result.payout > 0 && user) {
                await runTransaction(ref(database, `users/${user.id}/wallet`), (balance) => (balance || 0) + result.payout);
            }
            
            setTimeout(() => {
                if (totalUserBet > 0 && result.winnings > 0) {
                    congratsWordRef.current = congratulatoryWords[Math.floor(Math.random() * congratulatoryWords.length)];
                }
                setRoundResult(result);
                setGameState('result');
            }, 2000);

        } catch (e: any) {
            setError(e.message || "An error occurred.");
            if (totalUserBet > 0 && user) {
                runTransaction(ref(database, `users/${user.id}/wallet`), (balance) => (balance || 0) + totalUserBet);
            }
            startNewBettingRound();
        }
    }, [isProcessing, totalUserBet, user, bets, settings, currentBotActions, displayedBots, startNewBettingRound, toast]);

    useEffect(() => {
        if (gameState === 'betting' && displayedBots.length > 0 && Object.keys(currentBotActions).length > 0) {
            const botActionEntries = Object.entries(currentBotActions);
            let delay = 500;
            botActionEntries.forEach(([_, action]) => {
                setTimeout(() => {
                    setBotBets(prevBotBets => ({
                        ...prevBotBets,
                        [action.type]: prevBotBets[action.type] + action.amount
                    }));
                }, delay);
                delay += Math.floor(200 + Math.random() * 300);
            });
        }
    }, [gameState, displayedBots, currentBotActions]);

    useEffect(() => {
        if (gameState === 'betting' && !isProcessing) {
            const interval = setInterval(() => {
                setTimer(prev => prev > 0 ? prev - 1 : 0);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [gameState, isProcessing]);

    useEffect(() => {
        if (timer === 0 && gameState === 'betting' && !isProcessing) {
            handlePlayRound();
        }
    }, [timer, gameState, isProcessing, handlePlayRound]);
    
    useEffect(() => {
        if (gameState === 'result') {
            const newRoundTimeout = setTimeout(() => {
                startNewBettingRound();
            }, 5000); 

            return () => clearTimeout(newRoundTimeout);
        }
    }, [gameState, startNewBettingRound]);


    const backgroundImage = getDisplayableBannerUrl(settings?.imageUrl, 'dragon tiger background');
    const dataAiHint = generateDataAiHint(settings?.imageUrl, 'dragon tiger background');

    if (isLoadingSettings) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-10 w-10 text-accent"/></div>;
    if (!settings?.enabled) return <Alert variant="destructive" className="max-w-md mx-auto mt-10"><AlertTitle>Game Disabled</AlertTitle><AlertDescription>Dragon vs Tiger is currently unavailable.</AlertDescription></Alert>;
    if (!user) return <Alert className="max-w-md mx-auto mt-10"><AlertDescription className="text-center">Please <Link href="/auth/login" className="font-bold text-accent hover:underline">log in</Link> to play.</AlertDescription></Alert>;

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col p-2 sm:p-4 font-sans">
            <div className="relative w-full flex-grow bg-green-900/80 border-4 border-[#c0a060] rounded-2xl shadow-2xl shadow-yellow-800/20 overflow-hidden flex flex-col">
                <Image src={backgroundImage} alt="Dragon Tiger game background" fill className="object-cover z-0 opacity-30" data-ai-hint={dataAiHint} priority/>
                <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)' }} />
                
                <div className="relative z-20 flex flex-col h-full">
                    <div className="flex-shrink-0 p-2 flex items-center justify-center">
                        <div className="grid grid-cols-6 gap-1 sm:gap-2">
                            {displayedBots.map(p => <PlayerInfo key={p.id} player={p} />)}
                        </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col lg:flex-row items-center justify-around gap-2 p-1 sm:p-2">
                        <div className="w-full lg:w-1/3 h-1/2 lg:h-full flex flex-row lg:flex-col items-center justify-evenly lg:justify-center gap-2 lg:gap-4">
                            <div className="w-1/2 lg:w-auto">
                                {gameState !== 'betting' && roundResult?.dragonCard ? <motion.div key="dragon-card" initial={{ scale: 0.5, y: -100, opacity:0 }} animate={{ scale: 1, y: 0, opacity:1 }}><Image src={getCardImagePath(roundResult.dragonCard.key)} alt={`Dragon card ${roundResult.dragonCard.key}`} width={100} height={140} className="w-24 h-36"/></motion.div> : <CardBack />}
                            </div>
                            <div className="w-1/2 lg:w-full h-full">
                                <BettingArea type="Dragon" userBet={bets.Dragon} botBet={botBets.Dragon} onBet={() => handlePlaceBet('Dragon')} disabled={gameState !== 'betting' || totalUserBet > 0} />
                            </div>
                        </div>

                         <div className="w-full lg:w-auto h-1/4 lg:h-full flex flex-row-reverse lg:flex-col items-center justify-around lg:justify-center gap-4">
                            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-yellow-700/50 bg-black/50 text-4xl font-bold text-white" style={{textShadow: '0 0 8px hsl(var(--accent))'}}>
                                {gameState === 'betting' ? timer : <Swords/>}
                            </div>
                            <div className="w-2/3 sm:w-full lg:w-40 h-full lg:h-48">
                                <BettingArea type="Tie" userBet={bets.Tie} botBet={botBets.Tie} onBet={() => handlePlaceBet('Tie')} disabled={gameState !== 'betting' || totalUserBet > 0} />
                            </div>
                        </div>

                        <div className="w-full lg:w-1/3 h-1/2 lg:h-full flex flex-row lg:flex-col items-center justify-evenly lg:justify-center gap-2 lg:gap-4">
                            <div className="w-1/2 lg:w-auto">
                                {gameState !== 'betting' && roundResult?.tigerCard ? <motion.div key="tiger-card" initial={{ scale: 0.5, y: -100, opacity:0 }} animate={{ scale: 1, y: 0, opacity:1 }}><Image src={getCardImagePath(roundResult.tigerCard.key)} alt={`Tiger card ${roundResult.tigerCard.key}`} width={100} height={140} className="w-24 h-36"/></motion.div> : <CardBack />}
                            </div>
                             <div className="w-1/2 lg:w-full h-full">
                                <BettingArea type="Tiger" userBet={bets.Tiger} botBet={botBets.Tiger} onBet={() => handlePlaceBet('Tiger')} disabled={gameState !== 'betting' || totalUserBet > 0} />
                            </div>
                        </div>
                    </div>
                    
                    <AnimatePresence>
                        {gameState === 'result' && roundResult && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none">
                                {totalUserBet > 0 && roundResult.winnings > 0 ? (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 50, scale: 0.7, rotateX: -45 }}
                                        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                        className="text-center p-6 bg-gradient-to-br from-yellow-500 to-amber-700 rounded-xl shadow-2xl border-2 border-yellow-400 text-white"
                                        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
                                    >
                                        <div className="flex items-center justify-center mb-2">
                                            <Star className="h-8 w-8 text-yellow-300 animate-pulse" />
                                            <p className="text-4xl sm:text-5xl font-extrabold mx-2">{congratsWordRef.current}</p>
                                            <Star className="h-8 w-8 text-yellow-300 animate-pulse" />
                                        </div>
                                        <p className="text-sm">You bet <RupeeIcon className="inline h-3.5"/> {totalUserBet} and received a total of <RupeeIcon className="inline h-3.5"/> {roundResult.payout.toFixed(2)}!</p>
                                        <p className="text-xs text-yellow-200">(Multiplier: {(roundResult.payout / totalUserBet).toFixed(2)}x)</p>
                                    </motion.div>
                                ) : totalUserBet > 0 ? (
                                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-4xl font-bold text-gray-400">Better Luck Next Time!</motion.div>
                                ) : (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                        className={cn("text-5xl font-extrabold flex items-center gap-2", roundResult.winner === 'Dragon' && 'text-blue-400', roundResult.winner === 'Tiger' && 'text-red-400', roundResult.winner === 'Tie' && 'text-green-400')}
                                        style={{ textShadow: '0 0 15px currentColor' }}
                                    >
                                        {roundResult.winner} Wins!
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                         {gameState === 'dealing' && (
                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
                                <div className="text-3xl font-extrabold text-white animate-pulse" style={{ textShadow: '0 0 15px currentColor' }}>Dealing Cards...</div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-shrink-0 p-2 sm:p-4 bg-black/40 border-t-2 border-yellow-700/50">
                        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                            <div className="text-center sm:text-left sm:w-1/4">
                                <div className="text-xs text-gray-400">Your Balance</div>
                                <div className="font-bold text-sm sm:text-lg text-white flex items-center justify-center sm:justify-start"><RupeeIcon className="inline h-4 mr-1" /> {wallet.toFixed(2)}</div>
                            </div>
                            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-1 w-full overflow-x-auto pb-2 sm:pb-0">
                                {chipValues.map((value, index) => (
                                    <Chip key={value} value={value} isSelected={selectedChip === value} onSelect={() => setSelectedChip(value)} disabled={gameState !== 'betting'} colorClass={chipColors[index % chipColors.length]}/>
                                ))}
                            </div>
                             <div className="text-center sm:text-right sm:w-1/4 flex flex-col items-center sm:items-end">
                                <div className="text-xs text-gray-400">Total Bet</div>
                                <div className="font-bold text-sm sm:text-lg text-white flex items-center justify-center sm:justify-end min-h-[28px]">
                                    {totalUserBet > 0 ? (
                                         <><RupeeIcon className="inline h-4 mr-1" /> {totalUserBet.toLocaleString()}</>
                                    ) : (
                                        <span className="text-gray-500">No Bet</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                     {gameState === 'betting' && totalUserBet > 0 && (
                                        <Button variant="link" size="sm" className="h-auto p-0 text-red-400 text-xs" onClick={handleClearBet}>Clear Bet</Button>
                                    )}
                                    {gameState === 'betting' && (
                                        <Button size="sm" className="h-7 px-3 text-xs" onClick={handlePlayRound} disabled={isProcessing || totalUserBet === 0}>DEAL</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

