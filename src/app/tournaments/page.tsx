
"use client";

import React from 'react';
import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gamepad2, Trophy, CalendarDays, Award, ExternalLink, Loader2, ChevronDown, ChevronRight, UserCircle, PackageSearch } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ref, get, query, orderByChild, equalTo, onValue, off, set, update } from 'firebase/database';
import { format, parseISO, isValid, isFuture } from 'date-fns';

import LeaderboardTable from '@/components/leaderboard/leaderboard-table';
import GlassCard from "@/components/core/glass-card";
import RupeeIcon from "@/components/core/rupee-icon";
import TournamentCard from '@/components/tournaments/tournament-card';
import { useToast } from "@/hooks/use-toast";
import { database } from '@/lib/firebase/config';
import { auth } from '@/lib/firebase/config'; // Import auth
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Tournament, TournamentPlayer, PlayerResultStats, LeaderboardEntry, LeaderboardData } from '@/types';

// Type Definitions
interface TournamentPlayerJoinedData {
  uid: string;
  gameName: string;
  teamMembers?: Array<{ gameName: string; uid:string }>;
}

interface DialogCaptainEntry {
  captainFirebaseUID: string;
  captainStats: PlayerResultStats;
  captainAvatarUrl?: string | null;
  teamMembersDisplay: Array<{
    firebaseUID: string;
    username: string;
    inGameName: string;
    kills: number;
    avatarUrl: string | null;
  }>;
  isExpanded: boolean;
}


const parseTournamentData = (id: string, tData: any): Tournament => ({
  id,
  name: tData.name || `${tData.game || 'Game'} Tournament ${id.slice(-3)}`,
  game: tData.game || 'Other',
  mode: tData.mode || 'Custom',
  entryFee: Number(tData.entryFee) || 0,
  prizePool: Number(tData.prizePool) || 0,
  perKillReward: Number(tData.perKillReward) || 0,
  maxPlayers: Number(tData.maxPlayers) || 0,
  playersJoined: tData.playersJoined || {},
  joinedPlayersCount: tData.playersJoined ? Object.keys(tData.playersJoined).length : 0,
  status: tData.status || 'upcoming',
  startTime: tData.startTime || new Date().toISOString(),
  youtubeLive: tData.youtubeLive || undefined,
  customRules: tData.customRules || undefined,
  resultsPosted: Boolean(tData.resultsPosted),
  bannerImageUrl: tData.bannerImageUrl || undefined,
  autoPostResults: tData.autoPostResults,
  resultsProcessingTime: tData.resultsProcessingTime,
  autoPostCompleted: tData.autoPostCompleted,
});

async function getCompletedTournamentsWithResults(): Promise<Tournament[]> {
  if (!database) {
    console.warn("Firebase database not initialized");
    return [];
  }

  try {
    const tournamentsQuery = query(ref(database, 'tournaments'), orderByChild('status'), equalTo('completed'));
    const snapshot = await get(tournamentsQuery);

    if (snapshot.exists()) {
      const tournamentsData = snapshot.val();
      return Object.keys(tournamentsData)
        .filter(id => tournamentsData[id].resultsPosted === true)
        .map(id => parseTournamentData(id, tournamentsData[id]))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
    return [];
  } catch (error) {
    console.error("Error fetching completed tournaments:", error);
    return [];
  }
}

function processLeaderboardSnapshot(snapshot: any): LeaderboardEntry[] {
  if (!snapshot.exists()) {
    return [];
  }

  const leaderboardData = snapshot.val() as Record<string, LeaderboardData>;
  const entries: LeaderboardEntry[] = Object.keys(leaderboardData).map(gameUidOrUserId => {
    const entryData = leaderboardData[gameUidOrUserId];
    return {
      userId: gameUidOrUserId,
      username: entryData.username || entryData.inGameName || 'Player',
      kills: entryData.kills || 0,
      avatarUrl: entryData.avatarUrl,
      inGameName: entryData.inGameName || entryData.username || 'Player',
      inGameUID: entryData.inGameUID || gameUidOrUserId,
      rank: 0, // Will be calculated after sort
    };
  });

  // Sort by kills and assign rank
  const sortedEntries = entries
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  
  return sortedEntries;
}


export default function TournamentsHubPage() {
  const { toast } = useToast();
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    isLoading: boolean;
    error: string | null;
    selectedMatch: Tournament | null;
    matchResults: DialogCaptainEntry[];
  }>({
    isOpen: false,
    isLoading: false,
    error: null,
    selectedMatch: null,
    matchResults: [],
  });

  useEffect(() => {
    if (!database) {
      console.warn("Firebase database not initialized for leaderboard");
      setIsLoading(false);
      return;
    }

    const leaderboardRef = ref(database, 'leaderboards');
    const leaderboardListener = onValue(leaderboardRef, (snapshot) => {
      setLeaderboardEntries(processLeaderboardSnapshot(snapshot));
    }, (error) => {
      console.error("Leaderboard listener detached with error:", error);
      toast({ title: "Leaderboard Connection Error", description: `Leaderboard updates stopped: ${error.message}`, variant: "destructive" });
    });

    const tournamentsRef = ref(database, 'tournaments');
    const tournamentsListener = onValue(tournamentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setAllTournaments(
          Object.keys(data).map(id => parseTournamentData(id, data[id]))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        );
      } else {
        setAllTournaments([]);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Tournaments listener detached with error:", error);
      toast({ title: "Tournaments Connection Error", description: "Could not get live tournament updates.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      off(leaderboardRef, 'value', leaderboardListener);
      off(tournamentsRef, 'value', tournamentsListener);
    };
  }, [toast]);

  useEffect(() => {
    if (!database || allTournaments.length === 0) return;

    const checkAndPostResults = () => {
        allTournaments.forEach(tournament => {
            const shouldPost = 
                tournament.autoPostResults &&
                tournament.resultsProcessingTime &&
                tournament.status !== 'completed' &&
                !tournament.autoPostCompleted;

            if (shouldPost) {
                try {
                    const postTime = parseISO(tournament.resultsProcessingTime!);
                    if (isValid(postTime) && !isFuture(postTime)) {
                        console.log(`[TournamentsHub] Auto-posting results for tournament: ${tournament.name}`);
                        const tournamentRef = ref(database, `tournaments/${tournament.id}`);
                        update(tournamentRef, {
                            status: 'completed',
                            resultsPosted: true,
                            autoPostCompleted: true,
                        }).catch(error => {
                            console.error(`[TournamentsHub] Failed to auto-post for ${tournament.id}`, error);
                        });
                    }
                } catch(e) {
                    console.error(`[TournamentsHub] Error parsing resultsProcessingTime for tournament ${tournament.id}: ${tournament.resultsProcessingTime}`);
                }
            }
        });
    };

    const intervalId = setInterval(checkAndPostResults, 60 * 1000);
    checkAndPostResults();

    return () => clearInterval(intervalId);
  }, [allTournaments]);

  const openResultsDialog = useCallback(async (tournament: Tournament) => {
    setDialogState(prev => ({
      ...prev,
      isLoading: true,
      isOpen: true,
      selectedMatch: tournament,
      error: null,
      matchResults: [],
    }));

    if (!database) {
      setDialogState(prev => ({ ...prev, isLoading: false, error: "Database not available."}));
      return;
    }

    try {
      const resultsRefPath = `tournament_results/${tournament.id}/player_results`;
      const resultsSnapshot = await get(ref(database, resultsRefPath));
      const resultsData: Record<string, PlayerResultStats> = resultsSnapshot.exists() ? resultsSnapshot.val() : {};

      const playersJoinedRefPath = `tournaments/${tournament.id}/playersJoined`;
      const playersJoinedSnapshot = await get(ref(database, playersJoinedRefPath));
      const playersJoinedData: Record<string, TournamentPlayerJoinedData> = playersJoinedSnapshot.exists() ? playersJoinedSnapshot.val() : {};

      const captainEntries: DialogCaptainEntry[] = [];

      for (const captainFirebaseUID in playersJoinedData) {
        const captainJoinData = playersJoinedData[captainFirebaseUID];
        const captainGameUID = captainJoinData.uid;

        const captainResultData = resultsData[captainGameUID] || {};
        const captainProfileSnap = await get(ref(database, `users/${captainFirebaseUID}`));
        const captainProfileData = captainProfileSnap.exists() ? captainProfileSnap.val() : {};

        const captainStats: PlayerResultStats = {
          username: captainProfileData.username || captainJoinData.gameName,
          inGameName: captainJoinData.gameName,
          kills: captainResultData.kills ?? 0,
          earnings: captainResultData.earnings ?? 0,
          position: captainResultData.position,
          avatarUrl: captainProfileData.avatarUrl || null,
        };

        const teamMembersDisplay = [];
        if (captainJoinData.teamMembers) {
            for (const member of captainJoinData.teamMembers) {
                const memberGameUID = member.uid;
                const memberResultData = resultsData[memberGameUID] || {};

                teamMembersDisplay.push({
                    firebaseUID: memberResultData.firebaseUid || '',
                    username: memberResultData.username || member.gameName,
                    inGameName: member.gameName,
                    kills: memberResultData.kills ?? 0,
                    avatarUrl: memberResultData.avatarUrl || null,
                });
            }
        }

        captainEntries.push({
          captainFirebaseUID,
          captainStats,
          captainAvatarUrl: captainStats.avatarUrl,
          teamMembersDisplay,
          isExpanded: false,
        });
      }

      captainEntries.sort((a, b) => {
        const posA = a.captainStats.position !== undefined ? a.captainStats.position : Infinity;
        const posB = b.captainStats.position !== undefined ? b.captainStats.position : Infinity;
        if (posA !== posB) return posA - posB;
        return (b.captainStats.kills || 0) - (a.captainStats.kills || 0);
      });

      setDialogState(prev => ({
        ...prev,
        isLoading: false,
        matchResults: captainEntries,
      }));
    } catch (error) {
      console.error("Error loading match results for dialog:", error);
      setDialogState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load match results",
      }));
    }
 }, [toast]);


  const toggleTeamExpansion = useCallback((captainFirebaseUID: string) => {
    setDialogState(prev => ({
      ...prev,
      matchResults: prev.matchResults.map(team =>
        team.captainFirebaseUID === captainFirebaseUID
 ? { ...team, isExpanded: !team.isExpanded }
          : team
      ),
    }));
 }, []);

  const categorizedTournaments = useMemo(() => {
    const result: Record<string, {
      Solo: Tournament[];
      Duo: Tournament[];
      Squad: Tournament[];
      Custom: Tournament[];
      allCount: number;
    }> = {};

    const activeTournaments = allTournaments.filter(t => t.status === 'upcoming' || t.status === 'live');

    activeTournaments.forEach(tournament => {
      const game = tournament.game || 'Other';
      if (!result[game]) {
        result[game] = { Solo: [], Duo: [], Squad: [], Custom: [], allCount: 0 };
      }

      result[game].allCount++;
      const mode = tournament.mode || 'Custom';
      
      if (mode === 'Solo') result[game].Solo.push(tournament);
      else if (mode === 'Duo') result[game].Duo.push(tournament);
      else if (mode === 'Squad') result[game].Squad.push(tournament);
      else result[game].Custom.push(tournament);
    });

    return result;
  }, [allTournaments]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading ComBatZon...</p>
      </div>
    );
  }

  const gameKeys = Object.keys(categorizedTournaments);
  const gameModes = ['Solo', 'Duo', 'Squad', 'Custom'] as const;

  return (
    <div className="container mx-auto px-4 py-8">
      
      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-1 mb-6 bg-card/30">
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-4">
          {gameKeys.length > 0 ? (
            <Tabs defaultValue={gameKeys[0]} className="w-full">
              <TabsList className="flex flex-wrap justify-center gap-2 mb-4">
                {gameKeys.map(game => (
                  <TabsTrigger key={game} value={game}>
                    {game} ({categorizedTournaments[game].allCount})
                  </TabsTrigger>
                ))}
              </TabsList>

              {gameKeys.map(game => (
                <TabsContent key={game} value={game} className="space-y-4">
                  <Tabs defaultValue="Solo" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 mb-4 bg-card/30">
                      {gameModes.map(mode => (
                        <TabsTrigger key={mode} value={mode}>
                          {mode} ({categorizedTournaments[game][mode].length})
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {gameModes.map(mode => (
                      <TabsContent key={mode} value={mode}>
                        {categorizedTournaments[game][mode].length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                            {categorizedTournaments[game][mode].map(t => (
                              <TournamentCard key={t.id} tournament={t} />
                            ))}
                          </div>
                        ) : (
                          <GlassCard className="p-6 text-center mt-6">
                            <Gamepad2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
                            <p className="text-muted-foreground">No {mode} tournaments found for {game}.</p>
                          </GlassCard>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <GlassCard className="p-10 text-center">
              <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-xl text-muted-foreground">No game categories with tournaments available at the moment.</p>
            </GlassCard>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {allTournaments.filter(t => t.status === 'completed').length > 0 ? (
            allTournaments
              .filter(t => t.status === 'completed')
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map(tournament => (
                <GlassCard 
                  key={tournament.id} 
                  className="p-4 cursor-pointer hover:bg-accent/10"
                  onClick={() => openResultsDialog(tournament)}
                  disabled={dialogState.isOpen && dialogState.isLoading && dialogState.selectedMatch?.id === tournament.id}
                >
                  {dialogState.isOpen && dialogState.isLoading && dialogState.selectedMatch?.id === tournament.id ? (
                    <div className="flex items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin text-accent" /> Loading...</div>
                  ) : (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-accent">{tournament.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      {tournament.game} - {tournament.mode}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {isValid(parseISO(tournament.startTime)) 
                        ? format(parseISO(tournament.startTime), "dd MMM yyyy, hh:mm a") 
                        : 'Date N/A'}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Award className="mr-2 h-4 w-4" />
                      Prize Pool: <RupeeIcon className="inline h-3.5 mx-0.5"/>
                      {(tournament.prizePool || 0).toLocaleString()}
                    </div>
                  </div>
                  )}
                </GlassCard>
              ))
          ) : (
            <GlassCard className="p-6 text-center">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3"/>
              <p className="text-muted-foreground">No match results available</p>
            </GlassCard>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          <LeaderboardTable entries={leaderboardEntries} />
        </TabsContent>
      </Tabs>

      {/* Results Dialog */}
      <Dialog open={dialogState.isOpen} onOpenChange={open => setDialogState(prev => ({ ...prev, isOpen: open }))} aria-label="Match Results Dialog">
        <DialogContent className="glass-card sm:max-w-2xl">
          <DialogHeader> 
            <DialogTitle className="text-accent">
              {dialogState.selectedMatch?.name || 'Match'} Results 
            </DialogTitle>
          </DialogHeader>

          {dialogState.isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="mt-2 text-sm text-muted-foreground">Loading results...</p>
            </div>
          ) : dialogState.error ? (
            <div className="text-center text-sm text-destructive py-4">
              Error: {dialogState.error} 
            </div>
          ) : (
            <div className="space-y-4">
              <GlassCard className="p-4">
                <h4 className="text-md font-semibold mb-2">Match Details</h4>
                {dialogState.selectedMatch && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center"> 
                      <Gamepad2 className="mr-2 h-4 w-4" /> 
                      Game: {dialogState.selectedMatch.game}
                    </div>
                    <div className="flex items-center"> 
                      <Trophy className="mr-2 h-4 w-4" /> 
                      Mode: {dialogState.selectedMatch.mode}
                    </div>
                    <div className="flex items-center"> 
                      <CalendarDays className="mr-2 h-4 w-4" /> 
                      Date: {isValid(parseISO(dialogState.selectedMatch.startTime)) 
                        ? format(parseISO(dialogState.selectedMatch.startTime), "dd MMM yyyy, hh:mm a") 
                        : 'Date N/A'}
                    </div>
                    <div className="flex items-center"> 
                      <Award className="mr-2 h-4 w-4" /> 
                      Prize Pool: <RupeeIcon className="inline h-3.5 mx-0.5"/>
                      {(dialogState.selectedMatch.prizePool || 0).toLocaleString()}
                    </div>
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-4 max-h-96 overflow-y-auto">
                <h4 className="text-md font-semibold mb-2">Player Results</h4>
                {dialogState.matchResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Player</TableHead> 
                        <TableHead>In-Game Name</TableHead> 
                        <TableHead className="text-right">Kills</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dialogState.matchResults.map((captainEntry) => (
                        <React.Fragment key={captainEntry.captainFirebaseUID}>
                          <TableRow 
                            className={cn("hover:bg-muted/20 cursor-pointer", captainEntry.isExpanded && "bg-muted/10")}
                            onClick={() => toggleTeamExpansion(captainEntry.captainFirebaseUID)}
                          >
                            <TableCell className="text-center">
                              {captainEntry.teamMembersDisplay.length > 0 ? ( 
                                captainEntry.isExpanded ? <ChevronDown className="h-4 w-4 text-accent"/> : <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                              ) : null }
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 border-accent/50 border">
                                  <AvatarImage src={captainEntry.captainAvatarUrl || `https://placehold.co/64x64.png?text=${(captainEntry.captainStats.username || 'C').charAt(0)}`} alt={captainEntry.captainStats.username}/>
                                  <AvatarFallback>{(captainEntry.captainStats.username || 'C').charAt(0).toUpperCase()}</AvatarFallback> 
                                </Avatar>
                                <span className="font-semibold text-accent">{captainEntry.captainStats.username || 'Captain'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{captainEntry.captainStats.inGameName || 'N/A'}</TableCell>
                            <TableCell className="text-right">{captainEntry.captainStats.kills}</TableCell>
                          </TableRow>
                          {captainEntry.isExpanded && captainEntry.teamMembersDisplay.map((member, memberIndex) => (
                            <TableRow key={`${captainEntry.captainFirebaseUID}-member-${member.firebaseUID || memberIndex}`} className="bg-background/30 hover:bg-muted/30">
                              <TableCell></TableCell>
                               <TableCell>
                                <div className="flex items-center gap-2 pl-6">
                                    <Avatar className="h-8 w-8 border-muted/50 border">
                                    <AvatarImage src={member.avatarUrl || `https://placehold.co/64x64.png?text=${member.username.charAt(0)}`} alt={member.username}/>
                                    <AvatarFallback>{member.username.charAt(0).toUpperCase()}</AvatarFallback> 
                                    </Avatar>
                                    <span className="text-sm text-muted-foreground">{member.username}</span>
                                </div>
                                </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{member.inGameName || 'N/A'}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">{member.kills}</TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No results available for this match.
                  </div>
                )}
              </GlassCard>
            </div>
          )}
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
