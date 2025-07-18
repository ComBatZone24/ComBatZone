
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart2, Users, Target, Award, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import type { Tournament, PlayerResultStats } from '@/types';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface CalculationResult {
  joinedUsers: number;
  totalKills: number;
  entryPrice: number;
  perKillReward: number;
  prizePool: number;
  totalIncome: number;
  totalExpense: number;
  finalProfit: number;
}

export default function ProfitCalculatorPage() {
  const [completedTournaments, setCompletedTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCompletedTournaments = async () => {
      setIsLoading(true);
      if (!database) {
        toast({ title: "Database Error", description: "Database service not available.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const tournamentsRef = ref(database, 'tournaments');
        const q = query(tournamentsRef, orderByChild('status'), equalTo('completed'));
        const snapshot = await get(q);
        
        const tournaments: Tournament[] = [];
        if (snapshot.exists()) {
          snapshot.forEach(childSnapshot => {
            tournaments.push({ id: childSnapshot.key!, ...childSnapshot.val() });
          });
        }
        setCompletedTournaments(tournaments.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      } catch (err: any) {
        console.error("Error fetching completed tournaments:", err);
        toast({ title: "Fetch Error", description: "Could not load completed tournaments.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompletedTournaments();
  }, [toast]);

  const handleCalculateProfit = async () => {
    if (!selectedTournamentId) {
      toast({ title: "No Tournament Selected", description: "Please select a tournament to calculate its profit.", variant: "destructive" });
      return;
    }
    setIsCalculating(true);
    setCalculationResult(null);

    try {
      const tournament = completedTournaments.find(t => t.id === selectedTournamentId);
      if (!tournament) throw new Error("Selected tournament data not found.");
      
      const resultsRef = ref(database, `tournament_results/${selectedTournamentId}/player_results`);
      const resultsSnapshot = await get(resultsRef);
      let totalKills = 0;
      if (resultsSnapshot.exists()) {
        const resultsData = resultsSnapshot.val() as Record<string, PlayerResultStats>;
        totalKills = Object.values(resultsData).reduce((sum, player) => sum + (player.kills || 0), 0);
      }

      const joinedUsers = tournament.playersJoined ? Object.keys(tournament.playersJoined).length : 0;
      const entryPrice = tournament.entryFee || 0;
      const prizePool = tournament.prizePool || 0;
      const perKillReward = tournament.perKillReward || 0;

      const totalIncome = entryPrice * joinedUsers;
      const totalExpense = prizePool + (totalKills * perKillReward);
      const finalProfit = totalIncome - totalExpense;

      setCalculationResult({
        joinedUsers,
        totalKills,
        entryPrice,
        perKillReward,
        prizePool,
        totalIncome,
        totalExpense,
        finalProfit,
      });

    } catch (err: any) {
      toast({ title: "Calculation Error", description: err.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const ResultItem: React.FC<{ label: string, value: string | number | React.ReactNode, icon: React.ElementType, valueClassName?: string }> = ({ label, value, icon: Icon, valueClassName }) => (
    <div className="flex justify-between items-center p-3 bg-background/50 rounded-md">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={cn("font-mono text-lg font-bold", valueClassName)}>{value}</span>
    </div>
  );

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle 
        title="Tournament Profit Calculator"
        subtitle="Select a completed tournament to analyze its financial performance."
      />
      
      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow w-full">
            <label htmlFor="tournament-select" className="text-sm font-medium text-muted-foreground">Select a Completed Tournament</label>
            <Select onValueChange={setSelectedTournamentId} disabled={isLoading || isCalculating}>
              <SelectTrigger id="tournament-select" className="mt-1">
                <SelectValue placeholder={isLoading ? "Loading tournaments..." : "Choose a match"} />
              </SelectTrigger>
              <SelectContent className="glass-card">
                {completedTournaments.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.game})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCalculateProfit} disabled={!selectedTournamentId || isCalculating} className="w-full sm:w-auto">
            {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BarChart2 className="mr-2 h-4 w-4" />}
            Calculate
          </Button>
        </div>
      </GlassCard>

      {isCalculating ? (
        <GlassCard className="p-10 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent"/>
            <p className="ml-3 text-muted-foreground">Calculating...</p>
        </GlassCard>
      ) : calculationResult && (
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-4">Calculation Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm text-center text-muted-foreground">Match Metrics</h4>
                    <ResultItem label="Total Players" value={calculationResult.joinedUsers} icon={Users} />
                    <ResultItem label="Total Kills" value={calculationResult.totalKills} icon={Target} />
                    <ResultItem label="Entry Fee" value={<><RupeeIcon className="inline h-4"/> {calculationResult.entryPrice}</>} icon={RupeeIcon} />
                    <ResultItem label="Per Kill Reward" value={<><RupeeIcon className="inline h-4"/> {calculationResult.perKillReward}</>} icon={RupeeIcon} />
                    <ResultItem label="Prize Pool" value={<><RupeeIcon className="inline h-4"/> {calculationResult.prizePool}</>} icon={Award} />
                </div>
                 <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold text-sm text-center text-muted-foreground">Financial Summary</h4>
                    <ResultItem label="Total Income" value={<><RupeeIcon className="inline h-4"/> {calculationResult.totalIncome.toFixed(2)}</>} icon={TrendingUp} valueClassName="text-green-400" />
                    <ResultItem label="Total Expense" value={<><RupeeIcon className="inline h-4"/> {calculationResult.totalExpense.toFixed(2)}</>} icon={TrendingDown} valueClassName="text-red-400" />
                    <Separator className="my-3 bg-border"/>
                    <ResultItem 
                        label="Final Profit" 
                        value={<><RupeeIcon className="inline h-4"/> {calculationResult.finalProfit.toFixed(2)}</>} 
                        icon={FileText} 
                        valueClassName={calculationResult.finalProfit >= 0 ? 'text-green-400' : 'text-red-400'} 
                    />
                </div>
            </div>
        </GlassCard>
      )}
    </div>
  );
}
