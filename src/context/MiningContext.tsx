
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from './SettingsContext';
import type { CpuMiningSettings } from '@/types';
import { useAuth } from './AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, update, get, set, serverTimestamp } from 'firebase/database';

declare global {
    interface Window {
        Client: any; // CoinIMP attaches its Client to window
    }
}

interface MiningStats {
  hashesPerSecond: number;
  totalHashes: number;
  acceptedHashes: number;
}

interface MiningContextType {
  isMinerOpen: boolean;
  isMining: boolean;
  stats: MiningStats;
  coinsEarnedThisSession: number; // Renamed for clarity
  totalCoinsMined: number; // New state for persistent total
  openMiner: () => void;
  closeMiner: () => void;
  startMining: () => void;
  stopMining: () => void;
  isPinned: boolean;
  togglePinned: () => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  settings: CpuMiningSettings | null;
}

const MiningContext = createContext<MiningContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_POSITION = 'coinimp-miner-position';

export const MiningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const { settings: globalSettings, isLoadingSettings } = useSettings();
  const miningSettings = globalSettings?.cpuMiningSettings || null;
  
  // UI State
  const [isMinerOpen, setIsMinerOpen] = useState(false);
  const [position, setPositionState] = useState({ x: 300, y: 150 });
  const [isPinned, setIsPinned] = useState(false);
  
  // Mining State
  const [isMining, setIsMining] = useState(false);
  const [stats, setStats] = useState<MiningStats>({ hashesPerSecond: 0, totalHashes: 0, acceptedHashes: 0 });
  const [coinsEarnedThisSession, setCoinsEarnedThisSession] = useState(0);
  const [totalCoinsMined, setTotalCoinsMined] = useState(0);

  // Refs for instances and intervals
  const minerInstanceRef = useRef<any>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartHashesRef = useRef<number>(0);
  const isStoppingRef = useRef(false);

  // Load UI state from localStorage on mount
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem(LOCAL_STORAGE_KEY_POSITION);
      if (savedPos) setPositionState(JSON.parse(savedPos));
    } catch (error) { console.error("Failed to load mining position from localStorage", error); }
  }, []);
  
  // Update total coins from user profile
  useEffect(() => {
      setTotalCoinsMined(user?.cpuMiningEarnedCoins || 0);
  }, [user]);

  const setPosition = (pos: { x: number, y: number }) => {
    setPositionState(pos);
    localStorage.setItem(LOCAL_STORAGE_KEY_POSITION, JSON.stringify({ ...position, ...pos }));
  };

  const togglePinned = () => setIsPinned(prev => !prev);
  
  const saveMinedCoinsToDb = useCallback(async (earnedInSession: number) => {
    if (!user || !database || earnedInSession <= 0) return;
    isStoppingRef.current = true; // Flag to prevent multiple saves
    try {
        const userMiningRef = ref(database, `users/${user.id}/cpuMiningEarnedCoins`);
        const currentTotalSnap = await get(userMiningRef);
        const newTotal = (currentTotalSnap.val() || 0) + earnedInSession;
        await set(userMiningRef, newTotal);
        setTotalCoinsMined(newTotal);
        setCoinsEarnedThisSession(0); // Reset session earnings after saving
        toast({ title: "Progress Saved", description: `${earnedInSession.toFixed(6)} coins saved to your total.`, className:"bg-green-500/20"});
    } catch (error) {
        console.error("Failed to save mined coins to DB:", error);
    } finally {
        isStoppingRef.current = false;
    }
  }, [user, toast]);

  const initializeMiner = useCallback(async () => {
    if (minerInstanceRef.current) return minerInstanceRef.current;
    if (typeof window.Client === 'undefined') {
        toast({ title: "Mining Error", description: "Mining script not loaded. Please refresh.", variant: "destructive" });
        return null;
    }
    try {
      const throttleValue = miningSettings?.throttle !== undefined ? miningSettings.throttle / 100 : 0.8;
      const miner = new window.Client.Anonymous('c541f766e3a569d2f01a1e9b0e96fd02e62d2cc7886f8c03a646befe8911df6a', {
        throttle: throttleValue, c: 'w'
      });
      minerInstanceRef.current = miner;
      return miner;
    } catch (error) {
      toast({ title: "Mining Error", description: "Could not initialize the miner.", variant: "destructive" });
      return null;
    }
  }, [toast, miningSettings]);
  
  const stopMining = useCallback(() => {
    const minerInstance = minerInstanceRef.current;
    if (minerInstance && isMining && !isStoppingRef.current) {
        minerInstance.stop();
        setIsMining(false);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        if (coinsEarnedThisSession > 0) {
            saveMinedCoinsToDb(coinsEarnedThisSession);
        }
    }
  }, [isMining, coinsEarnedThisSession, saveMinedCoinsToDb]);

  const startMining = useCallback(async () => {
    if (isMining) return;
    const minerInstance = await initializeMiner();
    if (!minerInstance) return;
    
    await minerInstance.start();
    setIsMining(true);
    setCoinsEarnedThisSession(0); 

    sessionStartHashesRef.current = minerInstance.getAcceptedHashes();
    
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(() => {
        if (!minerInstanceRef.current) return;
        const currentAcceptedHashes = minerInstanceRef.current.getAcceptedHashes();
        const hashesThisSession = currentAcceptedHashes - sessionStartHashesRef.current;
        const coinsPerMillion = miningSettings?.coinsPer1MHashes || 0;
        const earned = (hashesThisSession / 1_000_000) * coinsPerMillion;

        setStats({
            hashesPerSecond: minerInstanceRef.current.getHashesPerSecond(),
            totalHashes: currentAcceptedHashes,
            acceptedHashes: currentAcceptedHashes,
        });
        setCoinsEarnedThisSession(earned);
    }, 1000);
    
  }, [initializeMiner, isMining, miningSettings]);
  
  const openMiner = useCallback(() => {
    const dialogWidth = 320;
    const dialogHeight = 450; 
    const newX = (window.innerWidth - dialogWidth) / 2;
    const newY = (window.innerHeight - dialogHeight) / 2;
    setPosition({ x: newX > 0 ? newX : 0, y: newY > 0 ? newY : 0 });
    setIsMinerOpen(true);
  }, []);

  const closeMiner = useCallback(() => setIsMinerOpen(false), []);
  
  // Save progress on unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isMining && coinsEarnedThisSession > 0) {
        saveMinedCoinsToDb(coinsEarnedThisSession);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isMining, coinsEarnedThisSession, saveMinedCoinsToDb]);
  
  const contextValue = {
    isMinerOpen, isMining, stats, coinsEarnedThisSession, totalCoinsMined,
    openMiner, closeMiner, startMining, stopMining,
    isPinned, togglePinned, 
    position, setPosition,
    settings: miningSettings,
    // Deprecated minimize functionality, kept for type safety
    isMinimized: !isMinerOpen,
    toggleMinimized: closeMiner,
  };
  
  return (
    <MiningContext.Provider value={contextValue}>
      {children}
    </MiningContext.Provider>
  );
};

export const useMining = () => {
  const context = useContext(MiningContext);
  if (context === undefined) {
    throw new Error('useMining must be used within a MiningProvider');
  }
  return context;
};
