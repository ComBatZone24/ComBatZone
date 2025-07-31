
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Loader2, Gamepad2, AlertCircle, Calendar, CheckCircle, BarChart, Package, MessageSquare as WhatsappIcon } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User, Tournament, PlayerResultStats } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DelegateTournamentStats {
  delegateName: string;
  delegateUid: string;
  delegateAvatar: string | null;
  delegateWhatsapp: string | null;
  totalCreated: number;
  weeklyCreated: number;
  monthlyCreated: number;
  totalCompleted: number;
  games: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
}

const StatItem: React.FC<{ icon: React.ElementType, label: string, value: string | number, valueClassName?: string }> = ({ icon: Icon, label, value, valueClassName }) => (
  <div className="flex flex-col items-center justify-center p-3 bg-background/50 rounded-lg text-center h-full">
    <Icon className="h-6 w-6 text-accent mb-2" />
    <span className={cn("text-2xl font-bold text-foreground", valueClassName)}>{value}</span>
    <span className="text-xs text-muted-foreground mt-1">{label}</span>
  </div>
);

export default function TournamentAnalysisPage() {
  const [analysisData, setAnalysisData] = useState<DelegateTournamentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAndAnalyzeData = async () => {
      setIsLoading(true);
      setError(null);
      if (!database) {
        setError("Database service is not available.");
        setIsLoading(false);
        return;
      }

      try {
        const usersSnapshot = await get(ref(database, 'users'));
        const tournamentsSnapshot = await get(ref(database, 'tournaments'));
        const resultsSnapshot = await get(ref(database, 'tournament_results'));

        if (!tournamentsSnapshot.exists()) {
          setAnalysisData([]);
          setIsLoading(false);
          return;
        }

        const allUsers: Record<string, User> = usersSnapshot.exists() ? usersSnapshot.val() : {};
        const allTournaments: Record<string, Tournament> = tournamentsSnapshot.val();
        const allResults: Record<string, { player_results: Record<string, PlayerResultStats> }> = resultsSnapshot.exists() ? resultsSnapshot.val() : {};

        const delegateStats: { [uid: string]: DelegateTournamentStats } = {};

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        for (const tId in allTournaments) {
            const tournament = allTournaments[tId];
            if (!tournament.createdBy) continue;

            const delegateUid = tournament.createdBy;

            if (!delegateStats[delegateUid]) {
                const delegateInfo = allUsers[delegateUid];
                delegateStats[delegateUid] = {
                    delegateUid,
                    delegateName: delegateInfo?.username || `Admin (${delegateUid.substring(0,6)})`,
                    delegateAvatar: delegateInfo?.avatarUrl || null,
                    delegateWhatsapp: delegateInfo?.whatsappNumber || null,
                    totalCreated: 0,
                    weeklyCreated: 0,
                    monthlyCreated: 0,
                    totalCompleted: 0,
                    games: {},
                    totalIncome: 0,
                    totalExpense: 0,
                };
            }

            const stats = delegateStats[delegateUid];
            stats.totalCreated++;

            const tournamentDate = new Date(tournament.startTime);
            if (!isNaN(tournamentDate.getTime())) {
              if (tournamentDate >= startOfWeek) stats.weeklyCreated++;
              if (tournamentDate >= startOfMonth) stats.monthlyCreated++;
            }

            if (tournament.status === 'completed') {
                stats.totalCompleted++;
            }

            const gameName = tournament.game || 'Unknown';
            stats.games[gameName] = (stats.games[gameName] || 0) + 1;

            const entryFee = tournament.entryFee || 0;
            const prizePool = tournament.prizePool || 0;
            const perKillReward = tournament.perKillReward || 0;
            const joinedPlayersCount = tournament.playersJoined ? Object.keys(tournament.playersJoined).length : 0;
            
            const totalEntryFees = entryFee * joinedPlayersCount;
            
            let totalKillPayout = 0;
            if (perKillReward > 0 && allResults[tId]?.player_results) {
                const playerResults = allResults[tId].player_results;
                const totalKills = Object.values(playerResults).reduce((sum, player: any) => sum + (player.kills || 0), 0);
                totalKillPayout = totalKills * perKillReward;
            }

            const totalPayouts = prizePool + totalKillPayout;
            stats.totalIncome += totalEntryFees;
            stats.totalExpense += totalPayouts;
        }

        const finalAnalysisData = Object.values(delegateStats)
          .sort((a, b) => (b.totalIncome - b.totalExpense) - (a.totalIncome - a.totalExpense));

        setAnalysisData(finalAnalysisData);
        
      } catch (err: any) {
        console.error("Error analyzing tournament data:", err);
        setError(err.message || "An unknown error occurred.");
        toast({ title: "Analysis Failed", description: "Could not process tournament data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndAnalyzeData();
  }, [toast]);
  
  if (isLoading) {
    return (
        <div className="flex-1 flex justify-center items-center h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="ml-3 text-muted-foreground text-lg">Analyzing tournament data...</p>
        </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle 
        title="Delegate Tournament Analysis"
        subtitle="Track tournament creation and profitability by delegate."
      />
        
      {error ? (
        <div className="p-6 text-center text-destructive">{error}</div>
      ) : analysisData.length === 0 ? (
        <GlassCard className="p-10 text-center">
            <Gamepad2 className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-xl text-muted-foreground">No tournament data found to analyze.</p>
            <p className="text-xs mt-1 text-muted-foreground">Tournaments need a `createdBy` field to appear in this analysis.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {analysisData.map((delegate) => {
              const netProfit = delegate.totalIncome - delegate.totalExpense;
              return (
                <GlassCard key={delegate.delegateUid} className="p-4 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <Avatar className="h-12 w-12 border-2 border-accent/50">
                            <AvatarImage src={delegate.delegateAvatar || undefined} alt={delegate.delegateName}/>
                            <AvatarFallback>{delegate.delegateName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{delegate.delegateName}</h3>
                            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1"><WhatsappIcon className="h-3 w-3" />{delegate.delegateWhatsapp || 'N/A'}</p>
                        </div>
                    </div>
                    <Separator className="bg-border/50 mb-4"/>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <StatItem icon={Gamepad2} label="Total Created" value={delegate.totalCreated} />
                        <StatItem icon={CheckCircle} label="Completed" value={delegate.totalCompleted} />
                        <StatItem icon={Calendar} label="This Week" value={delegate.weeklyCreated} />
                        <StatItem icon={Calendar} label="This Month" value={delegate.monthlyCreated} />
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg space-y-2 mb-4">
                        <h4 className="font-semibold text-sm text-muted-foreground text-center mb-2">Financial Summary</h4>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-green-400">Total Income</span>
                            <span className="font-mono text-foreground">
                                <RupeeIcon className="inline h-3.5"/> {delegate.totalIncome.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-red-400">Total Expenses</span>
                            <span className="font-mono text-foreground">
                                <RupeeIcon className="inline h-3.5"/> {delegate.totalExpense.toLocaleString()}
                            </span>
                        </div>
                        <Separator className="bg-border/50 my-2"/>
                        <div className="flex justify-between items-center text-md">
                            <span className="font-bold text-foreground">Net Profit</span>
                            <span className={cn("font-bold flex items-center justify-center gap-1", netProfit >= 0 ? 'text-green-400' : 'text-red-400')}>
                                <RupeeIcon className="inline h-4" /> {netProfit.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-border/50">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Games Hosted</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(delegate.games).length > 0 ? (
                            Object.entries(delegate.games).map(([game, count]) => (
                                <Badge key={game} variant="secondary">{game} ({count})</Badge>
                            ))
                          ) : (
                             <p className="text-xs text-muted-foreground italic">No games hosted yet.</p>
                          )}
                        </div>
                    </div>
                </GlassCard>
            )})}
        </div>
      )}
      
      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">How Profit is Calculated</AlertTitle>
        <AlertDescription className="!text-primary/80">
          Profit = (Total Entry Fees Collected) - (Total Prize Pool) - (Total Per-Kill Rewards Paid Out). This calculation depends on the tournament having complete player data and, for kill rewards, saved match results.
        </AlertDescription>
      </Alert>
    </div>
  );
}
