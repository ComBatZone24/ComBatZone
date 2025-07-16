
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { WalletTransaction } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Loader2, BarChart3, Coins, MousePointerClick, Calendar, Star, TrendingUp } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TaskStats {
  totalPointsEarned: number;
  dailyPoints: number;
  weeklyPoints: number;
  biWeeklyPoints: number;
  monthlyPoints: number;
  totalClicks: number;
  clickBreakdown: Record<string, number>;
}

const StatDisplay: React.FC<{ icon: React.ElementType, title: string, value: string | number, subtext?: string, valueClass?: string }> = ({ icon: Icon, title, value, subtext, valueClass }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-background/50 rounded-lg text-center h-full">
        <Icon className="h-8 w-8 text-accent mb-2" />
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground mt-1">{title}</span>
        {subtext && <span className="text-xs text-muted-foreground/70">{subtext}</span>}
    </div>
);

export default function TaskAnalysisPage() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!database) {
      setError("Database service is not available.");
      setIsLoading(false);
      return;
    }

    const transactionsRef = ref(database, 'walletTransactions');
    const clicksRef = ref(database, 'adminData/taskClicks');

    const handleData = () => {
      onValue(transactionsRef, (transactionsSnapshot) => {
        let totalPoints = 0;
        let dailyPoints = 0;
        let weeklyPoints = 0;
        let biWeeklyPoints = 0;
        let monthlyPoints = 0;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
        const fifteenDaysAgo = new Date(now);
        fifteenDaysAgo.setDate(now.getDate() - 15);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (transactionsSnapshot.exists()) {
          const allTransactionsByUser: Record<string, Record<string, WalletTransaction>> = transactionsSnapshot.val();
          for (const userId in allTransactionsByUser) {
            for (const txId in allTransactionsByUser[userId]) {
              const tx = allTransactionsByUser[userId][txId];
              if (tx.type === 'watch_earn_conversion') {
                const txDate = new Date(tx.date);
                if (!isNaN(txDate.getTime())) {
                  const points = tx.amount; // Assuming amount is points for this type
                  totalPoints += points;
                  if (txDate >= startOfToday) dailyPoints += points;
                  if (txDate >= startOfWeek) weeklyPoints += points;
                  if (txDate >= fifteenDaysAgo) biWeeklyPoints += points;
                  if (txDate >= startOfMonth) monthlyPoints += points;
                }
              }
            }
          }
        }
        
        onValue(clicksRef, (clicksSnapshot) => {
          const clickData = clicksSnapshot.exists() ? clicksSnapshot.val() : {};
          const totalClicks = Object.values(clickData).reduce((sum: number, count: any) => sum + (Number(count) || 0), 0);

          setStats({
            totalPointsEarned: totalPoints,
            dailyPoints,
            weeklyPoints,
            biWeeklyPoints,
            monthlyPoints,
            totalClicks,
            clickBreakdown: clickData,
          });
          setIsLoading(false);
          setError(null);
        }, (clickError) => {
          console.error("Error fetching clicks data:", clickError);
          setError("Could not load click engagement data.");
          setIsLoading(false);
        });

      }, (txError) => {
        console.error("Error fetching transactions data:", txError);
        setError("Could not load points conversion data.");
        setIsLoading(false);
      });
    };

    handleData();

    return () => {
      off(transactionsRef);
      off(clicksRef);
    };
  }, [toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /><p className="ml-3">Analyzing task data...</p></div>;
  }
  
  if (error) {
    return <GlassCard className="p-10 text-center text-destructive"><p>{error}</p></GlassCard>;
  }

  if (!stats) {
    return <GlassCard className="p-10 text-center"><p className="text-muted-foreground">No data available to display.</p></GlassCard>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Task &amp; Click Analysis" subtitle="Overview of user engagement with earning tasks." />
      
      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-4">Click Engagement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatDisplay icon={MousePointerClick} title="Total Clicks" value={stats.totalClicks.toLocaleString()} />
            {Object.entries(stats.clickBreakdown).map(([key, value]) => (
                <StatDisplay 
                    key={key}
                    icon={TrendingUp} 
                    title={`${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Clicks`} 
                    value={(Number(value) || 0).toLocaleString()} 
                />
            ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-4">Points Earned (from conversions)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatDisplay icon={Coins} title="All Time" value={stats.totalPointsEarned.toLocaleString()} />
            <StatDisplay icon={Calendar} title="Today" value={stats.dailyPoints.toLocaleString()} />
            <StatDisplay icon={Calendar} title="This Week" value={stats.weeklyPoints.toLocaleString()} />
            <StatDisplay icon={Calendar} title="Last 15 Days" value={stats.biWeeklyPoints.toLocaleString()} />
            <StatDisplay icon={Calendar} title="This Month" value={stats.monthlyPoints.toLocaleString()} />
        </div>
      </GlassCard>
    </div>
  );
}
