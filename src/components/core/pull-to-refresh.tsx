
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PULL_DISTANCE_TO_REFRESH = 80;

const PullToRefresh: React.FC = () => {
  const [pullDelta, setPullDelta] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      touchStartRef.current = { y: e.touches[0].clientY, active: true };
    } else {
      touchStartRef.current = { y: 0, active: false };
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current.active) return;

    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartRef.current.y;

    if (delta > 0) {
      setPullDelta(Math.pow(delta, 0.85));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current.active || isRefreshing) return;

    if (pullDelta > PULL_DISTANCE_TO_REFRESH) {
      setIsRefreshing(true);
      setPullDelta(PULL_DISTANCE_TO_REFRESH); // Keep indicator visible
      
      window.dispatchEvent(new CustomEvent('custom-refresh'));
      
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDelta(0);
      }, 1500);
      
    } else {
      setPullDelta(0);
    }
    
    touchStartRef.current = { y: 0, active: false };
  }, [isRefreshing, pullDelta]);
  
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;
    
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  const iconRotation = Math.min(pullDelta / PULL_DISTANCE_TO_REFRESH, 1) * 180;
  const showIndicator = pullDelta > 10;

  return (
    <div 
        className={cn(
          "fixed top-4 left-1/2 -translate-x-1/2 z-[99] flex items-center justify-center pointer-events-none transition-all duration-300 md:hidden",
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          transform: `translate(-50%, ${Math.min(pullDelta, PULL_DISTANCE_TO_REFRESH)}px) scale(${Math.min(1, pullDelta / PULL_DISTANCE_TO_REFRESH)})`
        }}
    >
        <div className="bg-card glass-card p-3 rounded-full shadow-lg">
            {isRefreshing ? (
                <Loader2 className="h-6 w-6 text-accent animate-spin" />
            ) : (
                <ArrowDown 
                    className="h-6 w-6 text-muted-foreground transition-transform duration-200"
                    style={{ transform: `rotate(${iconRotation}deg)`}}
                />
            )}
        </div>
    </div>
  );
};

export default PullToRefresh;
