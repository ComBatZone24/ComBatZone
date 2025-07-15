
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Tournament, GlobalSettings, PromoPost } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { Loader2, Rocket, Disc, Swords } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import TournamentCard from '@/components/tournaments/tournament-card';
import TournamentSlider from '@/components/core/tournament-slider';
import { Skeleton } from '@/components/ui/skeleton';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { getDisplayableBannerUrl, generateDataAiHint } from '@/lib/image-helper';
import ScrollingBanner from '@/components/core/ScrollingBanner';

const SliderLoadingSkeleton = () => (
  <Skeleton className="w-full h-72 md:h-96 rounded-lg bg-muted/30 border border-border/30" />
);

const GameCardSkeleton = () => (
    <Skeleton className="w-full h-80 rounded-lg bg-muted/30" />
);

const TournamentCardSkeleton = () => (
    <Skeleton className="w-full h-[400px] rounded-lg bg-muted/30" />
);


export default function HomePage() {
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [scrollingBanners, setScrollingBanners] = useState<PromoPost[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [isLoadingBanners, setIsLoadingBanners] = useState(true);
  const [settings, setSettings] = useState<Partial<GlobalSettings>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    if (!database) {
      console.warn("HomePage: Firebase database not initialized.");
      setIsLoadingTournaments(false);
      setIsLoadingSettings(false);
      setIsLoadingBanners(false);
      return;
    }

    setIsLoadingTournaments(true);
    setIsLoadingSettings(true);
    setIsLoadingBanners(true);

    const tournamentsQuery = ref(database, 'tournaments');
    const settingsRef = ref(database, 'globalSettings');
    const bannersRef = ref(database, 'scrollingBanners');

    const tournamentsListener = onValue(tournamentsQuery, (snapshot) => {
      const allFetched: Tournament[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(id => {
          const tData = data[id];
          allFetched.push({
            id,
            name: tData.name || `${tData.game || 'Game'} Tournament ${id.slice(-3)}`,
            game: tData.game || 'N/A',
            mode: tData.mode || 'Solo',
            entryFee: tData.entryFee || 0,
            prizePool: tData.prizePool || 0,
            perKillReward: tData.perKillReward || 0,
            maxPlayers: tData.maxPlayers || 0,
            playersJoined: tData.playersJoined || {},
            joinedPlayersCount: tData.playersJoined ? Object.keys(tData.playersJoined).length : 0,
            status: tData.status || 'upcoming',
            startTime: tData.startTime || new Date().toISOString(),
            youtubeLive: tData.youtubeLive,
            customRules: tData.customRules,
            resultsPosted: tData.resultsPosted || false,
            bannerImageUrl: tData.bannerImageUrl,
          });
        });
      }
      setAllTournaments(allFetched.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setIsLoadingTournaments(false);
    }, (error) => {
      console.error("HomePage: Error fetching tournaments from Firebase:", error);
      setIsLoadingTournaments(false);
    });

    const settingsListener = onValue(settingsRef, (snapshot) => {
      setSettings(snapshot.val() || {});
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("HomePage: Error fetching global settings from Firebase:", error);
      setIsLoadingSettings(false);
    });

    const bannersListener = onValue(bannersRef, (snapshot) => {
        const bannersData: PromoPost[] = [];
        if(snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(id => {
                if(data[id].enabled){
                     bannersData.push({ id, ...data[id] });
                }
            });
        }
        setScrollingBanners(bannersData.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)));
        setIsLoadingBanners(false);
    }, (error) => {
        console.error("HomePage: Error fetching scrolling banners:", error);
        setIsLoadingBanners(false);
    });


    return () => {
      if (database) {
        off(tournamentsQuery, 'value', tournamentsListener);
        off(settingsRef, 'value', settingsListener);
        off(bannersRef, 'value', bannersListener);
      }
    };
  }, []);

  const upcomingTournaments = useMemo(() => {
    return allTournaments.filter(t => t.status === 'upcoming');
  }, [allTournaments]);

  const { duelsCardSettings, spinWheelSettings, dragonTigerSettings } = settings;
  const gameCardsEnabled = 
    duelsCardSettings?.enabled ||
    spinWheelSettings?.enabled ||
    dragonTigerSettings?.enabled;


  return (
    <div className="space-y-12 md:space-y-16 pb-10">

      <section>
        {isLoadingTournaments ? (
          <SliderLoadingSkeleton />
        ) : (
          <TournamentSlider tournaments={upcomingTournaments} />
        )}
      </section>

      <section>
        {isLoadingBanners ? (
            <Skeleton className="w-full h-10 rounded-lg bg-muted/30" />
        ) : scrollingBanners.length > 0 ? (
            <ScrollingBanner banners={scrollingBanners} />
        ) : null}
      </section>
      
      <section>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground">The Arena Calls</h2>
            <p className="text-muted-foreground">Your next battle awaits.</p>
        </div>

        {isLoadingTournaments ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <TournamentCardSkeleton key={i} />)}
          </div>
        ) : upcomingTournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
          </div>
        ) : (
            <p className="text-center text-muted-foreground py-4">No upcoming tournaments right now. Check back soon!</p>
        )}
      </section>
      
      {!isLoadingSettings && gameCardsEnabled && (
        <section>
          <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground">Beyond The Arena</h2>
              <p className="text-muted-foreground">More ways to win.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {duelsCardSettings?.enabled && (
                  <Link href="/duels" className="w-full h-full flex">
                  <GlassCard interactive className="flex flex-col overflow-hidden group border border-border/30 hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 w-full">
                      <div className="relative w-full aspect-[4/3] overflow-hidden">
                      <Image
                          src={getDisplayableBannerUrl(duelsCardSettings.imageUrl, duelsCardSettings.title)}
                          alt={duelsCardSettings.title || "Cybernetic Duels"}
                          fill
                          style={{ objectFit: 'cover' }}
                          className="transition-transform duration-500 ease-in-out group-hover:scale-110"
                          data-ai-hint="cyberpunk duel arena"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      </div>
                      <div className="p-4 flex flex-col flex-grow bg-card/70">
                      <h3 className="text-lg font-semibold text-foreground mb-1 truncate group-hover:text-accent transition-colors">{duelsCardSettings.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-grow">
                          {duelsCardSettings.description}
                      </p>
                      <Button
                          className="w-full mt-auto neon-accent-bg text-accent-foreground"
                      >
                          <Rocket className="mr-2 h-4 w-4" /> {duelsCardSettings.buttonText}
                      </Button>
                      </div>
                  </GlassCard>
                  </Link>
              )}

              {spinWheelSettings?.enabled && (
                  <Link href="/spin-wheel" className="w-full h-full flex">
                  <GlassCard interactive className="flex flex-col overflow-hidden group border border-border/30 hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 w-full">
                      <div className="relative w-full aspect-[4/3] overflow-hidden">
                      <Image
                          src={getDisplayableBannerUrl(spinWheelSettings.imageUrl, spinWheelSettings.title)}
                          alt={spinWheelSettings.title || "Spin the Wheel"}
                          fill
                          style={{ objectFit: 'cover' }}
                          className="transition-transform duration-500 ease-in-out group-hover:scale-110"
                          data-ai-hint="colorful wheel casino"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      </div>
                      <div className="p-4 flex flex-col flex-grow bg-card/70">
                      <h3 className="text-lg font-semibold text-foreground mb-1 truncate group-hover:text-accent transition-colors">{spinWheelSettings.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-grow">
                          {spinWheelSettings.description}
                      </p>
                      <Button
                          className="w-full mt-auto neon-accent-bg text-accent-foreground"
                      >
                          <Disc className="mr-2 h-4 w-4" /> {spinWheelSettings.buttonText}
                      </Button>
                      </div>
                  </GlassCard>
                  </Link>
              )}

              {dragonTigerSettings?.enabled && (
                  <Link href="/dragon-tiger" className="w-full h-full flex">
                  <GlassCard interactive className="flex flex-col overflow-hidden group border border-border/30 hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 w-full">
                      <div className="relative w-full aspect-[4/3] overflow-hidden">
                      <Image
                          src={getDisplayableBannerUrl(dragonTigerSettings.imageUrl, dragonTigerSettings.title)}
                          alt={dragonTigerSettings.title || "Dragon vs Tiger"}
                          fill
                          style={{ objectFit: 'cover' }}
                          className="transition-transform duration-500 ease-in-out group-hover:scale-110"
                          data-ai-hint="dragon tiger playing cards"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      </div>
                      <div className="p-4 flex flex-col flex-grow bg-card/70">
                      <h3 className="text-lg font-semibold text-foreground mb-1 truncate group-hover:text-accent transition-colors">{dragonTigerSettings.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-grow">
                          {dragonTigerSettings.description}
                      </p>
                      <Button
                          className="w-full mt-auto neon-accent-bg text-accent-foreground"
                      >
                          <Swords className="mr-2 h-4 w-4" /> {dragonTigerSettings.buttonText}
                      </Button>
                      </div>
                  </GlassCard>
                  </Link>
              )}
          </div>
        </section>
      )}
    </div>
  );
}
