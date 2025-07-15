
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import PageTitle from '@/components/core/page-title';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ref, get, update, runTransaction, query, orderByChild, equalTo, push } from "firebase/database";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { database } from '@/lib/firebase/config';
import GlassCard from '@/components/core/glass-card';
import { Loader2, Save } from 'lucide-react';
import type { User as AppUserType, Tournament as TournamentType, TournamentPlayer, WalletTransaction } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import RupeeIcon from '@/components/core/rupee-icon';


interface PlayerWithKills {
  firebaseUid: string | null;
  gameUid: string;
  inGameName: string;
  username: string;
  avatarUrl: string | null;
  kills: number;
  earnings: number;
  teamId: string;
  isCaptain: boolean;
}

export default function ManageTournamentResultsPage() {
  const { id: tournamentId } = useParams<{ id:string }>();
  const [tournament, setTournament] = useState<TournamentType | null>(null);
  const [players, setPlayers] = useState<PlayerWithKills[]>([]);
  const [editedKills, setEditedKills] = useState<Record<string, number>>({});
  const [editedPrizes, setEditedPrizes] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!tournamentId) {
      setError("Tournament ID is missing.");
      setLoading(false);
      return;
    }

    try {
      const tournamentRef = ref(database, `tournaments/${tournamentId}`);
      const tournamentSnapshot = await get(tournamentRef);
      if (!tournamentSnapshot.exists()) throw new Error("Tournament not found.");
      const tournamentData = { id: tournamentId, ...tournamentSnapshot.val() };
      setTournament(tournamentData);

      const playersJoined = tournamentData.playersJoined || {};
      const resultsRef = ref(database, `tournament_results/${tournamentId}/player_results`);
      const resultsSnapshot = await get(resultsRef);
      const savedResults = resultsSnapshot.exists() ? resultsSnapshot.val() : {};

      const playerList: PlayerWithKills[] = [];
      const usersRef = ref(database, 'users');

      const processPlayer = async (joinData: TournamentPlayer, firebaseUid: string | null, teamId: string, isCaptain: boolean) => {
        const gameUid = joinData.uid;
        const inGameName = joinData.gameName;

        let profile: AppUserType | null = null;
        let foundFirebaseUid = firebaseUid;
        let username = 'Unlinked Player';

        if (!gameUid && !inGameName) return;
        
        let searchKey = gameUid || inGameName;
        const playerResultData = savedResults[searchKey] || {};

        if (foundFirebaseUid) {
          const profileSnapshot = await get(ref(database, `users/${foundFirebaseUid}`));
          if (profileSnapshot.exists()) {
            profile = profileSnapshot.val() as AppUserType;
            username = profile.username;
          }
        } else {
            let teammateSnapshot: any = null;
            if (gameUid) {
                const teammateByGameUidQuery = query(usersRef, orderByChild('gameUid'), equalTo(gameUid));
                teammateSnapshot = await get(teammateByGameUidQuery);
            }
            if (!teammateSnapshot || !teammateSnapshot.exists()) {
                const teammateByNameQuery = query(usersRef, orderByChild('gameName'), equalTo(inGameName));
                teammateSnapshot = await get(teammateByNameQuery);
            }
             if (!teammateSnapshot || !teammateSnapshot.exists()) {
                const teammateByUsernameQuery = query(usersRef, orderByChild('username'), equalTo(inGameName));
                teammateSnapshot = await get(teammateByUsernameQuery);
            }
            if(teammateSnapshot && teammateSnapshot.exists()){
                const usersData = teammateSnapshot.val();
                foundFirebaseUid = Object.keys(usersData)[0];
                profile = usersData[foundFirebaseUid];
                username = profile?.username || inGameName;
            }
        }

        playerList.push({
          firebaseUid: foundFirebaseUid,
          gameUid: gameUid || `temp_${inGameName}_${Math.random()}`,
          inGameName: inGameName || profile?.gameName || 'N/A',
          username: username,
          avatarUrl: profile?.avatarUrl || null,
          kills: playerResultData.kills || 0,
          earnings: playerResultData.earnings || 0,
          teamId: teamId,
          isCaptain: isCaptain,
        });
      };
      
      for (const captainFirebaseUid in playersJoined) {
        const captainJoinData = playersJoined[captainFirebaseUid];
        await processPlayer(captainJoinData, captainFirebaseUid, captainFirebaseUid, true);

        const teamMembers = captainJoinData.teamMembers || [];
        for (const member of teamMembers) {
          if (!member.uid && !member.gameName) continue;
          await processPlayer(member, null, captainFirebaseUid, false);
        }
      }

      playerList.sort((a, b) => {
        if (a.teamId < b.teamId) return -1;
        if (a.teamId > b.teamId) return 1;
        if (a.isCaptain) return -1;
        if (b.isCaptain) return 1;
        return a.username.localeCompare(b.username);
      });

      setPlayers(playerList);
      
      const initialKills: Record<string, number> = {};
      const initialPrizes: Record<string, number> = {};
      playerList.forEach(p => {
        initialKills[p.gameUid] = p.kills;
        if (p.firebaseUid) {
            initialPrizes[p.firebaseUid] = p.earnings;
        }
      });
      setEditedKills(initialKills);
      setEditedPrizes(initialPrizes);

    } catch (err: any) {
      console.error("Error loading data for results page:", err);
      let description = err.message;
      if (String(err.message).toUpperCase().includes("INDEX NOT DEFINED")) {
        description = "A required database index on 'gameUid' is missing. Please add it to your Firebase rules for the 'users' path."
      }
      setError(description);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleKillChange = (gameUid: string, value: string) => {
    const kills = parseInt(value, 10);
    if (!isNaN(kills) && kills >= 0) {
      setEditedKills(prev => ({ ...prev, [gameUid]: kills }));
    }
  };
  
  const handlePrizeChange = (firebaseUid: string, value: string) => {
    const prize = parseFloat(value);
    if (!isNaN(prize) && prize >= 0) {
      setEditedPrizes(prev => ({ ...prev, [firebaseUid]: prize }));
    }
  };


  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);
    if (!tournamentId || !database) {
      setError("Tournament ID is missing or database not initialized.");
      setIsSaving(false);
      return;
    }
  
    try {
      const updates: Record<string, any> = {};
      const leaderboardPromises = [];
  
      for (const player of players) {
        const gameUid = player.gameUid;
        const firebaseUid = player.firebaseUid;

        if (!gameUid || gameUid.startsWith('temp_')) {
            console.warn("Skipping player with missing or temporary game UID:", player);
            continue;
        }
        
        // --- Process Kills ---
        const newKillsInMatch = editedKills[gameUid];
        const oldKillsInMatch = player.kills || 0;
        
        if (newKillsInMatch !== undefined && newKillsInMatch !== oldKillsInMatch) {
            const resultPath = `tournament_results/${tournamentId}/player_results/${gameUid}`;
            updates[`${resultPath}/kills`] = newKillsInMatch;
            updates[`${resultPath}/inGameName`] = player.inGameName;
            if (player.username) updates[`${resultPath}/username`] = player.username;
            if (player.avatarUrl) updates[`${resultPath}/avatarUrl`] = player.avatarUrl;
            if (firebaseUid) updates[`${resultPath}/firebaseUid`] = firebaseUid;
    
            const killDifference = newKillsInMatch - oldKillsInMatch;
            const leaderboardRef = ref(database, `leaderboards/${gameUid}`);
            leaderboardPromises.push(runTransaction(leaderboardRef, (currentData) => {
              if (currentData === null) return { inGameUID: gameUid, inGameName: player.inGameName, username: player.username, avatarUrl: player.avatarUrl, kills: newKillsInMatch };
              currentData.inGameName = player.inGameName || currentData.inGameName;
              currentData.username = player.username || currentData.username;
              currentData.avatarUrl = player.avatarUrl || currentData.avatarUrl;
              currentData.kills = (currentData.kills || 0) + killDifference;
              return currentData;
            }));
        }

        // --- Process Prize Money ---
        if (firebaseUid && editedPrizes[firebaseUid] !== undefined) {
            const newPrize = editedPrizes[firebaseUid];
            const oldPrize = player.earnings || 0;
            const prizeDifference = newPrize - oldPrize;

            if (prizeDifference !== 0) {
                const userWalletRef = ref(database, `users/${firebaseUid}/wallet`);
                updates[`tournament_results/${tournamentId}/player_results/${gameUid}/earnings`] = newPrize;
                
                // Add prize amount to wallet
                leaderboardPromises.push(runTransaction(userWalletRef, (currentBalance) => {
                    return (currentBalance || 0) + prizeDifference;
                }));

                // Log the transaction for the prize adjustment
                const prizeTx: Omit<WalletTransaction, 'id'> = {
                    type: 'prize',
                    amount: prizeDifference,
                    status: 'completed',
                    date: new Date().toISOString(),
                    description: `Prize adjustment for tournament: ${tournament?.name}`,
                    relatedTournamentId: tournamentId,
                };
                leaderboardPromises.push(push(ref(database, `walletTransactions/${firebaseUid}`), prizeTx));
            }
        }
      }
  
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
      
      await Promise.all(leaderboardPromises);
      
      toast({ title: "Success", description: "Tournament results and prizes have been updated." });
      await loadData();
  
    } catch (saveError: any) {
      console.error("Error saving changes:", saveError);
      setError("Failed to save changes: " + saveError.message);
      toast({ title: "Error", description: "Failed to save results.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      {tournament && <PageTitle title={`Manage Results: ${tournament.name}`} />}

      {loading ? (
        <div className="p-4">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Error: {error}</div>
      ) : !tournament ? (
        <div className="p-4">Tournament not found or an error occurred.</div>
      ) : players.length > 0 ? (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>In-Game Name</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="text-center w-28">Kills</TableHead>
                  <TableHead className="text-center w-40">Prize (Rs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, index) => {
                  const isNewTeam = index === 0 || players[index - 1].teamId !== player.teamId;
                  const isPrizeEditable = tournament.mode === 'Solo' || player.isCaptain;
                  
                  return (
                    <React.Fragment key={player.gameUid}>
                      {isNewTeam && index > 0 && (
                          <TableRow className="border-t-2 border-border/50 bg-transparent hover:bg-transparent pointer-events-none">
                              <TableCell colSpan={5} className="p-1"></TableCell>
                          </TableRow>
                      )}
                      <TableRow className="border-b-border/20 hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                             <Avatar className="h-10 w-10 border-2 border-accent/30">
                                <AvatarImage src={player.avatarUrl || undefined} alt={player.username} />
                                <AvatarFallback>{player.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{player.username}</p>
                                <p className="text-xs text-muted-foreground">{player.firebaseUid ? `UID: ${player.firebaseUid.substring(0, 12)}...` : 'Unlinked Profile'}</p>
                              </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{player.inGameName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={player.isCaptain ? "default" : "secondary"}>
                            {player.isCaptain ? "Captain" : "Teammate"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={editedKills[player.gameUid] ?? 0}
                            onChange={(e) => handleKillChange(player.gameUid, e.target.value)}
                            className="w-24 mx-auto bg-input/50 border-border/70 text-center"
                            disabled={!player.gameUid || player.gameUid.startsWith('temp_')}
                            title={!player.gameUid || player.gameUid.startsWith('temp_') ? "Cannot edit kills without a valid Game UID" : "Enter kill count"}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                            {isPrizeEditable ? (
                                <div className="relative w-36 mx-auto">
                                <RupeeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editedPrizes[player.firebaseUid!] ?? ''}
                                    onChange={(e) => handlePrizeChange(player.firebaseUid!, e.target.value)}
                                    className="pl-8 bg-input/50 border-border/70 text-center"
                                    disabled={!player.firebaseUid}
                                    placeholder="0.00"
                                    title={!player.firebaseUid ? "Cannot award prize to unlinked player" : "Enter prize amount"}
                                />
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                            )}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 text-center border-t border-border/30">
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </GlassCard>
      ) : (
        <p className="mt-6 text-center text-muted-foreground">No players have joined this tournament yet.</p>
      )}
    </div>
  );
}
