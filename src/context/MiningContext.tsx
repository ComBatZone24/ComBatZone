
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from './SettingsContext';
import type { CpuMiningSettings } from '@/types';
import { useAuth } from './AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, update, get, set } from 'firebase/database';

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
  coinsEarned: number;
  openMiner: () => void;
  closeMiner: () => void;
  startMining: () => void;
  stopMining: () => void;
  isPinned: boolean;
  togglePinned: () => void;
  isMinimized: boolean;
  toggleMinimized: () => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  settings: CpuMiningSettings | null;
}

const MiningContext = createContext<MiningContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_POSITION = 'coinimp-miner-position';
const LOCAL_STORAGE_KEY_SESSION_HASHES = 'coinimp-session-hashes'; 
const LOCAL_STORAGE_KEY_MINING_STATE = 'coinimp-mining-state'; 

export const MiningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings: globalSettings, isLoadingSettings } = useSettings();
  const miningSettings = globalSettings?.cpuMiningSettings || null;
  
  // UI State
  const [isMinerOpen, setIsMinerOpen] = useState(false);
  const [position, setPositionState] = useState({ x: 300, y: 150 });
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Mining State
  const [isMining, setIsMining] = useState(false);
  const [stats, setStats] = useState<MiningStats>({ hashesPerSecond: 0, totalHashes: 0, acceptedHashes: 0 });
  const [coinsEarned, setCoinsEarned] = useState(0);

  // Refs for instances and intervals
  const minerInstanceRef = useRef<any>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionHashesRef = useRef<number>(0);

  const setPosition = (pos: { x: number, y: number }) => {
    setPositionState(pos);
    localStorage.setItem(LOCAL_STORAGE_KEY_POSITION, JSON.stringify({ ...position, ...pos }));
  };

  const togglePinned = () => setIsPinned(prev => !prev);
  
  const toggleMinimized = () => {
    setIsMinimized(prev => {
        const nextMinimizedState = !prev;
        if (nextMinimizedState) {
            setIsMinerOpen(false);
        }
        return nextMinimizedState;
    });
  };
  
  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem(LOCAL_STORAGE_KEY_POSITION);
      if (savedPos) setPositionState(JSON.parse(savedPos));
      
      const savedSessionHashes = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_HASHES);
      sessionHashesRef.current = savedSessionHashes ? parseInt(savedSessionHashes, 10) : 0;

    } catch (error) {
      console.error("Failed to load mining data from localStorage", error);
    }
  }, []);

  const saveMinedCoinsToDb = useCallback(async (earnedCoins: number) => {
    if (!user || !database || earnedCoins <= 0) return;
    try {
        const userMiningRef = ref(database, `users/${user.id}/cpuMiningEarnedCoins`);
        const currentTotalSnap = await get(userMiningRef);
        const newTotal = (currentTotalSnap.val() || 0) + earnedCoins;
        await set(userMiningRef, newTotal);
    } catch (error) {
        console.error("Failed to save mined coins to DB:", error);
    }
  }, [user]);

  const initializeMiner = useCallback(async () => {
    if (minerInstanceRef.current) return minerInstanceRef.current;
    
    if (typeof window.Client === 'undefined') {
        console.warn("CoinIMP Client not found on window. The script might not have loaded.");
        toast({ title: "Mining Error", description: "Mining script not loaded. Please refresh.", variant: "destructive" });
        return null;
    }
    
    try {
      const throttleValue = miningSettings?.throttle !== undefined ? miningSettings.throttle / 100 : 0.5;
      const miner = new window.Client.Anonymous('c541f766e3a569d2f01a1e9b0e96fd02e62d2cc7886f8c03a646befe8911df6a', {
        throttle: throttleValue, 
        c: 'w'
      });
      minerInstanceRef.current = miner;
      return miner;
    } catch (error) {
      console.error("Failed to initialize CoinIMP miner:", error);
      toast({ title: "Mining Error", description: "Could not initialize the miner.", variant: "destructive" });
      return null;
    }
  }, [toast, miningSettings]);
  
  const stopMining = useCallback(() => {
    const minerInstance = minerInstanceRef.current;
    if (minerInstance && isMining) {
        minerInstance.stop();
        setIsMining(false);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        
        const earnedCoins = coinsEarned;
        if (earnedCoins > 0) {
            saveMinedCoinsToDb(earnedCoins);
        }
        
        sessionHashesRef.current = 0;
        setCoinsEarned(0);
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_HASHES);
        localStorage.setItem(LOCAL_STORAGE_KEY_MINING_STATE, 'false');
    }
  }, [isMining, coinsEarned, saveMinedCoinsToDb]);

  const startMining = useCallback(async () => {
    const minerInstance = await initializeMiner();
    if (!minerInstance || isMining) return;
    
    await minerInstance.start();
    setIsMining(true);
    localStorage.setItem(LOCAL_STORAGE_KEY_MINING_STATE, 'true');
    
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(() => {
        const acceptedHashes = minerInstance.getAcceptedHashes();
        const hashesThisSession = acceptedHashes - sessionHashesRef.current;
        const coinsPerMillion = miningSettings?.coinsPer1MHashes || 0;
        const earned = (hashesThisSession / 1_000_000) * coinsPerMillion;

        setStats({
            hashesPerSecond: minerInstance.getHashesPerSecond(),
            totalHashes: acceptedHashes,
            acceptedHashes: acceptedHashes,
        });
        setCoinsEarned(earned);
    }, 1000);
    
  }, [initializeMiner, isMining, miningSettings]);
  
  const openMiner = useCallback(() => {
    setIsMinimized(false);
    const dialogWidth = 320;
    const dialogHeight = 450; 
    const newX = (window.innerWidth - dialogWidth) / 2;
    const newY = (window.innerHeight - dialogHeight) / 2;
    setPosition({ x: newX > 0 ? newX : 0, y: newY > 0 ? newY : 0 });
    setIsMinerOpen(true);
  }, []);

  const closeMiner = useCallback(() => {
    setIsMinerOpen(false);
  }, []);
  
  useEffect(() => {
    if (!isLoadingSettings && miningSettings?.enabled) {
      const wasMining = localStorage.getItem(LOCAL_STORAGE_KEY_MINING_STATE) === 'true';
      if (wasMining) {
          startMining();
      }
    } else if (!isLoadingSettings && !miningSettings?.enabled && isMining) {
        stopMining();
    }
  }, [startMining, stopMining, isLoadingSettings, miningSettings, isMining]);
  
  const contextValue = {
    isMinerOpen, isMining, stats, coinsEarned,
    openMiner, closeMiner, startMining, stopMining,
    isPinned, togglePinned, 
    isMinimized, toggleMinimized,
    position, setPosition,
    settings: miningSettings,
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
