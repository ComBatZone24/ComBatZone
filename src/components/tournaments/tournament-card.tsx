
"use client";

import React, { useState, useEffect, useCallback, MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseISO, isValid, isFuture } from 'date-fns';
import { ref, onValue, off, update, runTransaction, push, get } from 'firebase/database';

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
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, Users, Shield, Award, ClipboardList,
  UserPlus, Loader2, AlertTriangle, MessagesSquare, CheckCircle2, Banknote, Zap, Info
} from 'lucide-react'; 
import { Progress } from '@/components/ui/progress';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, 
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RupeeIcon from '@/components/core/rupee-icon';


interface TournamentCardProps {
  tournament: Tournament;
}

const InfoItem: React.FC<{ icon: React.ElementType; label: string; value: string | number | JSX.Element; className?: string }> = ({ icon: Icon, label, value, className }) => (
    <div className={cn("text-center bg-muted/20 p-2 rounded-lg", className)}>
        <Icon className="h-6 w-6 text-accent mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-bold text-sm text-foreground flex items-center justify-center gap-1">{value}</p>
    </div>
);

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament: initialTournament }) => {
  const [currentTournament, setCurrentTournament] = useState<Tournament>(initialTournament);
  const { user: currentUserProfile, loading: isAuthLoading } = useAuth();
  const { openChat } = useFloatingChat();
  const { triggerButtonAd } = useAd();
  const { toast } = useToast();
  
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  const [userGameName, setUserGameName] = useState('');
  const [userGameUid, setUserGameUid] = useState('');

  const [teamMembers, setTeamMembers] = useState<{ gameName: string; uid: string }[]>([]);
  const [numCustomTeammates, setNumCustomTeammates] = useState<number>(1);

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

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
    }, (error) => {
      console.error(`Error fetching tournament ${initialTournament.id}:`, error);
    });

    return () => off(tournamentRef, 'value', listener);
  }, [initialTournament]);

  const {
    id, name, game, mode, map, entryFee, prizePool, perKillReward,
    maxPlayers, joinedPlayersCount = 0, status, startTime, bannerImageUrl, customRules, playersJoined = {}
  } = currentTournament;

  useEffect(() => {
    if (currentUserProfile && playersJoined) setIsAlreadyJoined(!!playersJoined[currentUserProfile.id]);
    else setIsAlreadyJoined(false);
  }, [currentUserProfile, playersJoined]);

  useEffect(() => {
    setUserGameName(currentUserProfile?.gameName || '');
    setUserGameUid(currentUserProfile?.gameUid || '');
  }, [currentUserProfile]);

  useEffect(() => {
    if (isJoinDialogOpen) {
      let count = (mode === 'Duo' ? 1 : mode === 'Squad' ? 3 : mode === 'Custom' ? numCustomTeammates : 0);
      setTeamMembers(prev => Array(count).fill(null).map((_, i) => prev[i] || { gameName: '', uid: '' }));
    }
  }, [isJoinDialogOpen, mode, numCustomTeammates]);

  const parsedStartTime = isValid(parseISO(startTime)) ? parseISO(startTime) : null;
  const showCountdown = status === 'upcoming' && parsedStartTime && isFuture(parsedStartTime);
  const finalBannerUrl = getDisplayableBannerUrl(bannerImageUrl, game);
  const hint = generateDataAiHint(bannerImageUrl, game);

  const isFull = joinedPlayersCount >= maxPlayers;
  const canJoin = !isAuthLoading && currentUserProfile && status === 'upcoming' && !isFull && !isAlreadyJoined && parsedStartTime && isFuture(parsedStartTime);
  
  const handleOpenJoinDialog = () => setIsJoinDialogOpen(true);

  const handleJoinTournament = async () => {
    if (!canJoin || !currentUserProfile || !database) { toast({ title: "Cannot Join", description: "Unable to join.", variant: "destructive" }); return; }
    setIsSubmittingJoin(true);
    const playerGameName = userGameName.trim() || 'Player', playerGameId = userGameUid.trim() || currentUserProfile.id.slice(0, 8);
    const newPlayerEntry: TournamentPlayer = { uid: playerGameId, gameName: playerGameName, kills: 0, joinTime: new Date().toISOString(), teamMembers: [] };
    const requiredTeammatesCount = mode === 'Duo' ? 1 : mode === 'Squad' ? 3 : mode === 'Custom' ? numCustomTeammates : 0;
    if (requiredTeammatesCount > 0) {
      const filledTeammates = [];
      for (let i = 0; i < requiredTeammatesCount; i++) {
        if (!teamMembers[i]?.gameName?.trim() || !teamMembers[i]?.uid?.trim()) {
          toast({ title: "Team Error", description: `Please fill all details for Teammate ${i + 1}.`, variant: "destructive" });
          setIsSubmittingJoin(false); return;
        }
        filledTeammates.push({ gameName: teamMembers[i].gameName.trim(), uid: teamMembers[i].uid.trim() });
      }
      newPlayerEntry.teamMembers = filledTeammates;
    }
    try {
      if (entryFee > 0) {
        await runTransaction(ref(database, `users/${currentUserProfile.id}/wallet`), (balance) => { if ((balance || 0) < entryFee) return; return (balance || 0) - entryFee; });
        await push(ref(database, `walletTransactions/${currentUserProfile.id}`), { type: 'entry_fee', amount: -entryFee, status: 'completed', date: new Date().toISOString(), description: `Entry fee for ${name}`, tournamentId: id });
      }
      await update(ref(database, `tournaments/${id}/playersJoined/${currentUserProfile.id}`), newPlayerEntry);
      setIsAlreadyJoined(true);
      toast({ title: "Joined Successfully!", description: `You've joined ${name}. Good luck!`, variant: "default", className: "bg-green-500/20" });
      setIsJoinDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Join Failed", description: error.message || "Could not join tournament.", variant: "destructive" });
    } finally { setIsSubmittingJoin(false); }
  };

  const teammateFieldsCount = mode === 'Duo' ? 1 : mode === 'Squad' ? 3 : mode === 'Custom' ? numCustomTeammates : 0;

  return (
    <>
      <GlassCard className="flex flex-col overflow-hidden transition-all duration-300 w-full max-w-sm mx-auto group">
        <Link href={`/tournaments/${id}`} className="block">
          <div className="relative w-full h-40 md:h-48">
            <Image src={finalBannerUrl} alt={name} fill style={{ objectFit: "cover" }} className="transition-transform duration-500 group-hover:scale-110" sizes="(max-width: 768px) 100vw, 33vw" data-ai-hint={hint} priority />
            <div className="absolute inset-0 flex flex-col justify-between p-3">
              <div className="flex justify-between items-start">
                <Badge variant="secondary" className={cn("uppercase text-xs px-1.5 py-0.5 bg-black/50 border-border", {
                  'text-red-400 border-red-400 animate-pulse': status === 'live',
                  'text-yellow-400 border-yellow-400': status === 'upcoming',
                  'text-green-400 border-green-400': status === 'completed',
                })}>{status}</Badge>
                {showCountdown && <CountdownTimer targetDate={startTime} size="sm" className="text-white" />}
              </div>
            </div>
          </div>
        </Link>
        <div className="p-3 flex flex-col flex-grow">
          <Link href={`/tournaments/${id}`} className="block">
            <div className="mb-2"> 
              <h3 className="font-bold text-lg text-foreground leading-tight mb-0.5">{name}</h3> 
              <p className="text-xs text-muted-foreground">{game} - {mode}{map ? ` - ${map}` : ''}</p> 
            </div>
            
             <div className="grid grid-cols-3 gap-2 mb-3">
                <InfoItem icon={Banknote} label="Entry" value={entryFee > 0 ? <><RupeeIcon className="inline h-3.5"/> {entryFee}</> : 'Free'} />
                <InfoItem icon={Award} label="Prize Pool" value={<><RupeeIcon className="inline h-3.5"/> {prizePool.toLocaleString()}</>} />
                <InfoItem icon={Zap} label="Per Kill" value={<><RupeeIcon className="inline h-3.5"/> {perKillReward || 0}</>} />
            </div>

            <div className="mb-3 mt-1">
              <Progress value={(joinedPlayersCount / maxPlayers) * 100} className="w-full h-1.5 bg-accent/20" indicatorClassName="bg-accent" />
             <p className="text-xs text-muted-foreground mt-1 text-right">{joinedPlayersCount} / {maxPlayers} Players</p>
            </div>
          </Link>
          <div className="mt-auto grid grid-cols-3 gap-2">
            <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 text-xs" disabled={!customRules}>Rules</Button>
              </DialogTrigger>
              <DialogContent className="glass-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><ClipboardList/> Rules for {name}</DialogTitle>
                </DialogHeader>
                <div className="py-4 whitespace-pre-line text-sm text-muted-foreground max-h-60 overflow-y-auto">
                  {customRules || "No special rules for this tournament."}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" className="h-9 text-xs" onClick={() => openChat(currentTournament)} disabled={!isAlreadyJoined}>
              <MessagesSquare className="mr-1 h-4 w-4"/> Chat
            </Button>
            
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 text-xs neon-accent-bg" disabled={!canJoin || isSubmittingJoin} onClick={() => triggerButtonAd(handleOpenJoinDialog, 'tournament_join_now')}>
                   {isSubmittingJoin ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                   {isAlreadyJoined ? "Joined" : isFull ? "Full" : "Join Now"}
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card sm:max-w-md">
                 <DialogHeader>
                    <DialogTitle className="text-accent flex items-center"><UserPlus className="mr-2" />Join: {name}</DialogTitle>
                    <DialogDescription>Entry fee: Rs {entryFee}.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="my-4 space-y-4">
                        <Alert variant="default" className="bg-background/50 border-border/50"><Info className="h-4 w-4 !text-foreground" /><AlertTitle className="text-foreground">Your Details</AlertTitle><AlertDescription className="text-xs text-muted-foreground">Current Wallet: <span className="font-semibold text-foreground">Rs {currentUserProfile?.wallet?.toFixed(2) || '0.00'}</span></AlertDescription></Alert>
                        <div className="space-y-2"><div><Label htmlFor="userGameName" className="text-xs text-muted-foreground">IGN</Label><Input id="userGameName" value={userGameName} onChange={(e) => setUserGameName(e.target.value)} placeholder="Your IGN" className="mt-1 bg-input/50"/></div><div><Label htmlFor="userGameUid" className="text-xs text-muted-foreground">Game ID</Label><Input id="userGameUid" value={userGameUid} onChange={(e) => setUserGameUid(e.target.value)} placeholder="Your Game ID" className="mt-1 bg-input/50"/></div>{(!userGameName.trim() || !userGameUid.trim()) && (<Alert variant="destructive" className="text-xs"><AlertTriangle className="h-4 w-4"/> <AlertDescription>Please fill IGN and Game ID.</AlertDescription></Alert>)}</div>
                        {mode === 'Custom' && (<div className="space-y-2 mb-4"><Label htmlFor="numCustomTeammatesSelect" className="text-xs text-muted-foreground">Teammates</Label><Select value={String(numCustomTeammates)} onValueChange={(value) => setNumCustomTeammates(parseInt(value, 10))}><SelectTrigger id="numCustomTeammatesSelect" className="bg-input/50"><SelectValue/></SelectTrigger><SelectContent className="glass-card"><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent></Select></div>)}
                        {teammateFieldsCount > 0 && (<div className="space-y-4 p-3 bg-muted/20 rounded-md border border-border/30"><p className="text-sm font-medium">Team Member Details ({mode})</p>{Array.from({ length: teammateFieldsCount }).map((_, index) => (<div key={index} className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Teammate {index + 1}</p><div><Label htmlFor={`teamMate${index + 1}GameName`} className="text-xs text-muted-foreground sr-only">IGN</Label><Input id={`teamMate${index + 1}GameName`} value={teamMembers[index]?.gameName || ''} onChange={(e) => { const newMems = [...teamMembers]; newMems[index] = {...newMems[index], gameName: e.target.value}; setTeamMembers(newMems); }} placeholder={`Teammate ${index+1} IGN`} className="mt-1 bg-input/50"/></div><div><Label htmlFor={`teamMate${index + 1}GameId`} className="text-xs text-muted-foreground sr-only">Game ID</Label><Input id={`teamMate${index + 1}GameId`} value={teamMembers[index]?.uid || ''} onChange={(e) => { const newMems = [...teamMembers]; newMems[index] = {...newMems[index], uid: e.target.value}; setTeamMembers(newMems); }} placeholder={`Teammate ${index + 1} Game ID`} className="mt-1 bg-input/50"/></div></div>))}</div>)}
                        {(currentUserProfile?.wallet ?? 0) < entryFee && entryFee > 0 && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Insufficient Balance</AlertTitle><AlertDescription>You need Rs {entryFee.toFixed(2)} to join. Balance: Rs {(currentUserProfile?.wallet ?? 0).toFixed(2)}.</AlertDescription></Alert>)}
                    </div>
                </ScrollArea>
                <DialogFooter className="gap-2 sm:gap-0 pt-4">
                  <DialogClose asChild><Button variant="outline" disabled={isSubmittingJoin}>Cancel</Button></DialogClose>
                  <Button onClick={handleJoinTournament} className="neon-accent-bg" disabled={isSubmittingJoin || ((currentUserProfile?.wallet ?? 0) < entryFee && entryFee > 0) || !userGameName.trim() || !userGameUid.trim()}>
                    {isSubmittingJoin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Pay Rs {entryFee} & Join
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </GlassCard>
    </>
  );
};

export default TournamentCard;
