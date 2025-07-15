
"use client";

import { useState, useEffect } from 'react';
import LeaderboardTable from '@/components/leaderboard/leaderboard-table';
import type { LeaderboardEntry } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, query, orderByChild, limitToLast, onValue, off } from 'firebase/database';
import PageTitle from '@/components/core/page-title';
import { Loader2 } from 'lucide-react';
import GlassCard from '@/components/core/glass-card';

export default function LeaderboardPage() {
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!database) {
      console.warn("Leaderboard: Firebase database is not initialized.");
      setLoading(false);
      return;
    }

    const leaderboardQuery = query(ref(database, 'leaderboards'), orderByChild('kills'), limitToLast(50));
    
    const listener = onValue(leaderboardQuery, (snapshot) => {
      if (!snapshot.exists()) {
        console.log("No leaderboard data found in Firebase.");
        setLeaderboardEntries([]);
        setLoading(false);
        return;
      }

      const leaderboardData = snapshot.val();
      const entries: LeaderboardEntry[] = Object.keys(leaderboardData).map(gameUid => ({
        userId: gameUid, // Keep property name for compatibility, but it holds gameUid
        username: leaderboardData[gameUid].username || leaderboardData[gameUid].inGameName || 'Player',
        kills: leaderboardData[gameUid].kills || 0,
        inGameName: leaderboardData[gameUid].inGameName || leaderboardData[gameUid].username || 'Player',
        inGameUID: leaderboardData[gameUid].inGameUID || gameUid,
        rank: 0, // Placeholder for rank
      }));

      // Since Firebase returns limitToLast in ascending order, we must reverse sort on the client
      const sortedEntries = entries
        .sort((a, b) => b.kills - a.kills)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      setLeaderboardEntries(sortedEntries);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching leaderboard data from Firebase:", error);
        setLoading(false);
    });

    // Cleanup listener on component unmount
    return () => {
        if (database) {
            off(leaderboardQuery, 'value', listener);
        }
    };
  }, []);

  return (
    <div className="container mx-auto py-8">
      <PageTitle title="Leaderboard" subtitle="Top 50 Players Ranked by Total Kills" />
      {loading ? (
        <GlassCard className="p-6 flex justify-center items-center h-64">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
        </GlassCard>
      ) : (
        <LeaderboardTable entries={leaderboardEntries} />
      )}
    </div>
  );
}
