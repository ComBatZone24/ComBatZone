
"use client";

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: string; // ISO string
  onComplete?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const initialTimeLeftState = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, onComplete, className, size = 'md' }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeftState);
  const [isClient, setIsClient] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    const difference = +new Date(targetDate) - +new Date();
    let newTime = { ...initialTimeLeftState };

    if (difference > 0) {
      newTime = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return newTime;
  }, [targetDate]);

  useEffect(() => {
    setIsClient(true); // This runs only on the client, after the initial render

    const intervalId = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);

      const currentDifference = +new Date(targetDate) - +new Date();
      if (currentDifference <= 0) {
        clearInterval(intervalId);
        if (onComplete) {
          onComplete();
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [targetDate, onComplete, calculateTimeLeft]);

  // On the server and during initial client render, show a placeholder.
  // After hydration, `isClient` becomes true and the real countdown is shown.
  if (!isClient) {
    return (
       <div className={cn("flex space-x-1 sm:space-x-2", className)}>
         {['Days', 'Hours', 'Mins', 'Secs'].map((label, index) => (
           <React.Fragment key={label}>
             <div className="flex flex-col items-center p-1 bg-muted/30 rounded-md min-w-[30px] sm:min-w-[40px]">
                <span className={cn("font-bold tabular-nums", {
                    'text-xs sm:text-sm': size === 'sm',
                    'text-sm sm:text-lg': size === 'md',
                    'text-base sm:text-xl': size === 'lg',
                })}>
                  00
                </span>
                <span className={cn("text-[0.5rem] sm:text-xs text-muted-foreground uppercase", {
                    'text-[0.5rem] sm:text-[0.6rem]': size === 'sm',
                    'text-[0.6rem] sm:text-[0.7rem]': size === 'md',
                    'text-[0.7rem] sm:text-xs': size === 'lg',
                })}>
                  {label}
                </span>
             </div>
             {index < 3 && <span className={cn("self-center font-bold", { 'text-xs': size === 'sm', 'text-sm': size === 'md', 'text-base': size === 'lg' })}>:</span>}
           </React.Fragment>
         ))}
       </div>
    );
  }

  const timeParts = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Mins', value: timeLeft.minutes },
    { label: 'Secs', value: timeLeft.seconds },
  ];

  return (
    <div className={cn("flex space-x-1 sm:space-x-2", className)}>
      {timeParts.map((part, index) => (
        <React.Fragment key={part.label}>
          <div className="flex flex-col items-center p-1 bg-muted/30 rounded-md min-w-[30px] sm:min-w-[40px]">
            <span className={cn("font-bold tabular-nums", {
              'text-xs sm:text-sm': size === 'sm',
              'text-sm sm:text-lg': size === 'md',
              'text-base sm:text-xl': size === 'lg',
            })}>
              {String(part.value).padStart(2, '0')}
            </span>
            <span className={cn("text-[0.5rem] sm:text-xs text-muted-foreground uppercase", {
              'text-[0.5rem] sm:text-[0.6rem]': size === 'sm',
              'text-[0.6rem] sm:text-[0.7rem]': size === 'md',
              'text-[0.7rem] sm:text-xs': size === 'lg',
            })}>
              {part.label}
            </span>
          </div>
          {index < timeParts.length - 1 && <span className={cn("self-center font-bold", { 'text-xs': size === 'sm', 'text-sm': size === 'md', 'text-base': size === 'lg' })}>:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default CountdownTimer;
