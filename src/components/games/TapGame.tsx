
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Heart, Play, Repeat, Star, Bomb, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from '../core/glass-card';

type GameStatus = 'idle' | 'playing' | 'gameOver';
type TileType = 'normal' | 'bonus' | 'danger';

const GRID_SIZE = 9; // 3x3 grid
const INITIAL_LIVES = 3;
const INITIAL_SPEED = 1200;

export default function TapGame() {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [highScore, setHighScore] = useState(0);
  
  const [activeTile, setActiveTile] = useState<{ index: number; type: TileType } | null>(null);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<() => void>();

  // Fix for Hydration Error: Load high score only on the client-side
  useEffect(() => {
    setHighScore(parseInt(localStorage.getItem('tapGameHighScore') || '0', 10));
  }, []);
  
  // Save high score whenever it changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('tapGameHighScore', score.toString());
    }
  }, [score, highScore]);

  const endTurn = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setLives(prevLives => {
        const newLives = prevLives - 1;
        if (newLives <= 0) {
            setStatus('gameOver');
        } else {
            // Delay next turn slightly after a miss
            setTimeout(() => gameLoopRef.current?.(), 300);
        }
        return newLives;
    });
  }, []);

  const nextTurn = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    let nextTileIndex;
    do {
      nextTileIndex = Math.floor(Math.random() * GRID_SIZE);
    } while (nextTileIndex === activeTile?.index);

    const rand = Math.random();
    let nextTileType: TileType = 'normal';
    if (rand < 0.1) nextTileType = 'danger';
    else if (rand < 0.25) nextTileType = 'bonus';

    setActiveTile({ index: nextTileIndex, type: nextTileType });

    timerRef.current = setTimeout(() => {
        if (status === 'playing') {
             endTurn();
        }
    }, speed);
  }, [activeTile?.index, speed, status, endTurn]);
  
  gameLoopRef.current = nextTurn;

  const startGame = () => {
    setScore(0);
    setLives(INITIAL_LIVES);
    setSpeed(INITIAL_SPEED);
    setStatus('playing');
  };

  useEffect(() => {
    if (status === 'playing') {
      nextTurn();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status]); // Only runs when status changes

  const handleTileClick = (index: number) => {
    if (status !== 'playing' || index !== activeTile?.index) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (activeTile.type === 'danger') {
        endTurn();
        return;
    }
    
    const points = activeTile.type === 'bonus' ? 5 : 1;
    setScore(prev => prev + points);
    setSpeed(prev => Math.max(300, prev * 0.975));
    
    nextTurn();
  };

  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="text-center">
            <Shield className="mx-auto h-16 w-16 text-accent mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Ready to Play?</h2>
            <p className="text-muted-foreground mt-2 mb-6">High Score: {highScore}</p>
            <Button onClick={startGame} size="lg" className="neon-accent-bg text-lg">
              <Play className="mr-2" /> Start Game
            </Button>
          </div>
        );
      case 'gameOver':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">Game Over</h2>
            <p className="text-xl text-muted-foreground mt-2">Your Score: {score}</p>
            <p className="text-md text-muted-foreground">High Score: {highScore}</p>
            <Button onClick={startGame} size="lg" className="mt-6">
              <Repeat className="mr-2" /> Play Again
            </Button>
          </div>
        );
      case 'playing':
        return (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-2">
                    {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
                        <Heart key={i} className={cn("h-5 w-5 transition-colors", i < lives ? 'text-red-500 fill-current' : 'text-muted-foreground/30')} />
                    ))}
                </div>
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="text-2xl font-bold text-accent">{score}</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: GRID_SIZE }).map((_, i) => {
                  const isActive = i === activeTile?.index;
                  const type = isActive ? activeTile?.type : 'normal';
                  
                  return (
                    <motion.button
                      key={i}
                      onClick={() => handleTileClick(i)}
                      className={cn(
                        "aspect-square rounded-lg border-2 transition-colors duration-100 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent flex items-center justify-center",
                        isActive ? 'scale-105 shadow-lg' : 'bg-muted/30 border-border/50 hover:bg-muted/50',
                        isActive && type === 'normal' && 'bg-accent border-accent/80 shadow-accent/50',
                        isActive && type === 'bonus' && 'bg-green-500 border-green-400 shadow-green-500/50',
                        isActive && type === 'danger' && 'bg-red-600 border-red-500 shadow-red-600/50'
                      )}
                      whileTap={{ scale: isActive ? 0.95 : 1 }}
                      initial={false}
                      animate={isActive ? { scale: [1, 1.1, 1], transition: { duration: speed / 1000, repeat: Infinity, repeatType: 'mirror' } } : { scale: 1 }}
                    >
                      {isActive && type === 'bonus' && <Star className="h-8 w-8 text-white"/>}
                      {isActive && type === 'danger' && <Bomb className="h-8 w-8 text-white"/>}
                    </motion.button>
                  )
              })}
            </div>
          </div>
        );
    }
  };

  return (
    <GlassCard className="w-full max-w-sm p-6 flex items-center justify-center min-h-[420px]">
        {renderContent()}
    </GlassCard>
  );
}
