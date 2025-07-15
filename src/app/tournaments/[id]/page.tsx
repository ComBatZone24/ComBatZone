
"use client";

import React, { useState, useEffect, useCallback, MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseISO, isValid, isFuture } from 'date-fns';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, off, update, runTransaction, push, serverTimestamp, get } from 'firebase/database';

import type { Tournament, TournamentPlayer, User as AppUserType } from '@/types';
import { auth, database } from '@/lib/firebase/config';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDisplayableBannerUrl, generateDataAiHint } from '@/lib/image-helper';
import { useAuth } from '@/context/AuthContext';
import { useFloatingChat } from '@/context/FloatingChatContext';
import { useAd } from '@/context/AdContext';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import CountdownTimer from '@/components/core/countdown-timer';
import RupeeIcon from '@/components/core/rupee-icon';
import TournamentUserList from '@/components/tournaments/tournament-user-list';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, 
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  CalendarDays, Users, Shield, Award, ClipboardList,
  UserPlus, Loader2, AlertTriangle, MessagesSquare, CheckCircle2, KeyRound, Eye, EyeOff, Copy, Zap, Clock
} from 'lucide-react'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

interface TournamentDetailPageClientProps {
  initialTournament: Tournament;
}

const InfoItem: React.FC<{ icon: React.ElementType; label: string; value: string | number | JSX.Element }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/20">
    <Icon className="h-5 w-5 text-accent mt-1 shrink-0" />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

const TournamentDetailPageClient: React.FC<TournamentDetailPageClientProps> = ({ initialTournament }) => {
  const { user: currentUserProfile, loading: isAuthLoading } = useAuth();
  const { openChat } = useFloatingChat();
  const { toast } = useToast();

  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(initialTournament);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [isCountdownFinished, setIsCountdownFinished] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!database || !initialTournament?.id) {
      setCurrentTournament(initialTournament);
      return;
    }
    const tournamentRef = ref(database, `tournaments/${initialTournament.id}`);
    const listener = onValue(tournamentRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedTournamentData = { id: snapshot.key, ...snapshot.val() } as Tournament;
        updatedTournamentData.playersJoined = updatedTournamentData.playersJoined || {};
        updatedTournamentData.joinedPlayersCount = Object.keys(updatedTournamentData.playersJoined).length;
        setCurrentTournament(updatedTournamentData);
      }
    });
    return () => off(tournamentRef, 'value', listener);
  }, [initialTournament]);

  const handleAutoPostResults = useCallback(async () => {
    if (!database || !currentTournament?.id || currentTournament.status === 'completed' || currentTournament.autoPostCompleted) return;
    console.log(`Auto-posting results for tournament ${currentTournament.id}`);
    const updates: Partial<Tournament> = { status: 'completed', resultsPosted: true, autoPostCompleted: true };
    try {
        await update(ref(database, `tournaments/${currentTournament.id}`), updates);
        toast({ title: "Results Posted", description: `Results for "${currentTournament.name}" are now live.` });
    } catch (error) {
        console.error("Failed to auto-post results:", error);
    }
  }, [currentTournament, toast]);

  useEffect(() => {
    if (currentUserProfile && currentTournament?.playersJoined) setIsAlreadyJoined(!!currentTournament.playersJoined[currentUserProfile.id]);
    else setIsAlreadyJoined(false);
  }, [currentUserProfile, currentTournament?.playersJoined]);


  useEffect(() => {
      if (currentTournament?.startTime) {
        const parsedStartTime = parseISO(currentTournament.startTime);
        if(isValid(parsedStartTime)){
             setIsCountdownFinished(!isFuture(parsedStartTime));
        }
      }
  }, [currentTournament?.startTime]);

   if (!currentTournament) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="mt-4 text-lg text-foreground">Loading tournament details...</p>
        </div>
    );
  }

  const { id, name, game, mode, map, entryFee, prizePool, perKillReward, maxPlayers, joinedPlayersCount = 0, status, startTime, youtubeLive, customRules, bannerImageUrl, playersJoined = {}, roomId, roomPassword, resultsProcessingTime, autoPostResults } = currentTournament;

  const finalBannerUrl = getDisplayableBannerUrl(bannerImageUrl, game);
  const hint = generateDataAiHint(bannerImageUrl, game);
  const parsedStartTime = isValid(parseISO(startTime)) ? parseISO(startTime) : null;
  const showCountdown = status === 'upcoming' && parsedStartTime && isFuture(parsedStartTime);
  const parsedResultsTime = resultsProcessingTime && isValid(parseISO(resultsProcessingTime)) ? parseISO(resultsProcessingTime) : null;
  const showAutoPostCountdown = autoPostResults && status === 'live' && parsedResultsTime && isFuture(parsedResultsTime);
  
  const statusBadgeClass = status === 'live' ? 'text-red-400 border-red-400' : status === 'upcoming' ? 'text-yellow-400 border-yellow-400' : status === 'completed' ? 'text-green-400 border-green-400' : 'text-muted-foreground border-border';
  const isRoomDetailsVisible = isAlreadyJoined && (status === 'live' || (status === 'upcoming' && isCountdownFinished));

  const handleCopyRoomPassword = (e: MouseEvent) => {
    e.stopPropagation();
    if (roomPassword) { navigator.clipboard.writeText(roomPassword); toast({ description: "Room password copied!" }); }
  };
  
  const playersArray: TournamentPlayer[] = Object.values(playersJoined || {});

  return (
    <div className="space-y-8 pt-2">
      <div className="relative w-full h-64 md:h-96 rounded-xl overflow-hidden shadow-2xl"><Image src={finalBannerUrl} alt={name || 'Tournament Banner'} fill style={{ objectFit: "cover" }} priority data-ai-hint={hint} sizes="(max-width: 768px) 100vw, 50vw"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 md:p-8 flex flex-col justify-end"><Badge variant="secondary" className={`absolute top-4 right-4 uppercase ${statusBadgeClass} bg-background/70`}>{status}</Badge><h1 className="text-3xl md:text-5xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.7)'}}>{name}</h1><p className="text-lg text-gray-200" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.7)'}}>{game}</p></div></div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <GlassCard>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h2 className="text-2xl font-semibold text-foreground mb-2 sm:mb-0">Match Details</h2>
              {showCountdown && parsedStartTime && <CountdownTimer targetDate={startTime} className="text-accent" size="lg" onComplete={() => setIsCountdownFinished(true)} />}
            </div>
            <Separator className="my-4 bg-border/50" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><InfoItem icon={Shield} label="Mode" value={mode} /><InfoItem icon={Banknote} label="Entry Fee" value={entryFee > 0 ? `Rs ${entryFee}` : 'Free'} /><InfoItem icon={Award} label="Prize Pool" value={`Rs ${prizePool.toLocaleString()}`} /><InfoItem icon={Zap} label="Per Kill Reward" value={`Rs ${perKillReward}`} /><InfoItem icon={Users} label="Players" value={`${joinedPlayersCount || 0} / ${maxPlayers}`} /><InfoItem icon={CalendarDays} label="Start Time" value={parsedStartTime ? new Date(startTime).toLocaleString() : 'Date TBD'} /></div>
          </GlassCard>
          {isRoomDetailsVisible && (<GlassCard><h2 className="text-xl font-semibold text-foreground mb-3 flex items-center"><KeyRound className="mr-2 h-5 w-5 text-accent" /> Room Credentials</h2><div className="space-y-3"><div className="p-3 bg-muted/30 rounded-md border border-border/50"><p className="text-xs text-muted-foreground">Room ID</p><p className="text-lg font-bold text-foreground font-mono">{roomId || <span className="text-sm italic text-muted-foreground">Not available yet</span>}</p></div><div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50"><div><p className="text-xs text-muted-foreground">Room Password</p><p className="text-lg font-bold text-foreground font-mono">{showPassword ? (roomPassword || <span className="text-sm italic text-muted-foreground">Not available</span>) : '••••••••'}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleCopyRoomPassword}><Copy className="h-4 w-4" /></Button></div></div></div></GlassCard>)}
          {showAutoPostCountdown && parsedResultsTime && <GlassCard><h2 className="text-xl font-semibold text-foreground mb-2 flex items-center"><Clock className="mr-2 h-5 w-5 text-accent"/> Time Until Results</h2><CountdownTimer targetDate={resultsProcessingTime!} onComplete={handleAutoPostResults} className="text-accent" size="lg"/></GlassCard>}
          {customRules && (<GlassCard><h2 className="text-xl font-semibold text-foreground mb-3 flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-accent" /> Rules</h2><p className="text-muted-foreground whitespace-pre-line text-sm">{customRules}</p></GlassCard>)}
          {status === 'completed' && currentTournament.resultsPosted && (<GlassCard><h2 className="text-xl font-semibold text-foreground mb-3 flex items-center"><Award className="mr-2 h-5 w-5 text-accent" /> Results</h2><p className="text-muted-foreground text-sm">Results are posted.</p></GlassCard>)}
        </div>
        <div className="space-y-6">
           <GlassCard><h3 className="text-lg font-semibold text-foreground mb-4">Actions</h3>
            {isAlreadyJoined && (
              <Button className="w-full" variant="outline" onClick={() => openChat(currentTournament)}><MessagesSquare className="mr-2 h-4 w-4"/>Open Chat</Button>
            )}
            {!isAlreadyJoined && (
                <p className="text-sm text-muted-foreground text-center">Join from the main tournaments page to participate.</p>
            )}
           </GlassCard>
           <TournamentUserList players={playersArray} maxPlayers={maxPlayers} />
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailPageClient;
