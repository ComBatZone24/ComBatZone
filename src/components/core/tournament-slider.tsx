
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Tournament } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getDisplayableBannerUrl, generateDataAiHint } from '@/lib/image-helper';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownTimer from '@/components/core/countdown-timer';
import { parseISO, isValid, isFuture } from 'date-fns';

interface TournamentSliderProps {
  tournaments: Tournament[];
  slideInterval?: number; // in milliseconds
}

const TournamentSlider: React.FC<TournamentSliderProps> = ({ tournaments, slideInterval = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? tournaments.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === tournaments.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  useEffect(() => {
    if (!tournaments || tournaments.length <= 1) return;

    const interval = setInterval(() => {
      goToNext();
    }, slideInterval);

    return () => clearInterval(interval);
  }, [tournaments, slideInterval, currentIndex]); // Added currentIndex to reset interval on manual nav

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="h-64 md:h-96 flex items-center justify-center bg-muted/30 rounded-lg border border-border/30">
        <p className="text-muted-foreground">No featured tournaments available right now.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden shadow-2xl group glass-card p-0">
      {tournaments.map((tournament, index) => {
        const loopDisplayUrl = getDisplayableBannerUrl(tournament.bannerImageUrl, tournament.game);
        const loopHint = generateDataAiHint(tournament.bannerImageUrl, tournament.game);
        
        let parsedStartTime = null;
        try {
          parsedStartTime = parseISO(tournament.startTime);
        } catch (e) { /* stay null */ }
        const isValidStartTime = parsedStartTime && isValid(parsedStartTime);
        const showCountdown = tournament.status === 'upcoming' && isValidStartTime && isFuture(parsedStartTime);

        return (
            <div
              key={tournament.id || index}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              )}
            >
              <Image
                src={loopDisplayUrl}
                alt={tournament.name || 'Tournament Banner'}
                fill
                style={{ objectFit: 'cover' }}
                priority={index === 0} 
                data-ai-hint={loopHint}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="transform group-hover:scale-105 transition-transform duration-500 ease-out"
              />
              {showCountdown && index === currentIndex && (
                <div className="absolute top-3 left-3 z-20 bg-background/70 p-1.5 rounded-md shadow-lg backdrop-blur-sm">
                  <CountdownTimer targetDate={tournament.startTime} size="sm" className="text-accent-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col justify-end p-6 md:p-10">
                <h2 
                  className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-3 leading-tight" 
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                >
                  {tournament.name}
                </h2>
                <p 
                  className="text-md md:text-xl text-gray-100 mb-4 md:mb-6" 
                  style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.6)' }}
                >
                  {tournament.game} - {tournament.mode}
                </p>
                <Link href={`/tournaments/all?tournamentId=${tournament.id}`} passHref legacyBehavior>
                  <Button 
                    variant="default" 
                    size="lg" // Increased button size
                    className="neon-accent-bg self-start text-base md:text-lg py-3 px-6 rounded-lg shadow-lg hover:shadow-accent/60 transition-all duration-300 transform hover:scale-105"
                  >
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
        )
      })}
      {tournaments.length > 1 && (
        <>
          <Button 
            onClick={goToPrevious} 
            variant="outline" 
            size="icon" 
            className="absolute top-1/2 left-3 md:left-5 transform -translate-y-1/2 z-20 bg-black/30 text-white hover:bg-black/50 border-white/30 hover:border-white rounded-full h-10 w-10 md:h-12 md:w-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button 
            onClick={goToNext} 
            variant="outline" 
            size="icon" 
            className="absolute top-1/2 right-3 md:right-5 transform -translate-y-1/2 z-20 bg-black/30 text-white hover:bg-black/50 border-white/30 hover:border-white rounded-full h-10 w-10 md:h-12 md:w-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          <div className="absolute bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
            {tournaments.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all duration-300 ease-in-out",
                  currentIndex === index ? "bg-accent scale-125 w-4" : "bg-white/40 hover:bg-white/70"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TournamentSlider;
