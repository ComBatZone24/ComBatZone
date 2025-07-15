
import type { LeaderboardEntry } from '@/types';
import GlassCard from '@/components/core/glass-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries }) => {
  if (!entries || entries.length === 0) {
    return (
      <GlassCard className="p-6">
        <p className="text-center text-muted-foreground py-8">The leaderboard is currently empty. Be the first to make your mark!</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b-border/50">
            <TableHead className="w-[80px] text-center">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">Total Kills</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => {
            const displayName = entry.inGameName || entry.username;
            return (
              <TableRow
                key={entry.userId}
                className={cn("border-b-border/20 hover:bg-muted/20", {
                  'bg-yellow-500/10 hover:bg-yellow-500/20': entry.rank === 1,
                  'bg-gray-500/10 hover:bg-gray-500/20': entry.rank === 2,
                  'bg-orange-500/10 hover:bg-orange-500/20': entry.rank === 3,
                })}
              >
                <TableCell className="text-center">
                  {entry.rank === 1 && <Award className="w-8 h-8 text-yellow-400 inline-block" />}
                  {entry.rank === 2 && <Award className="w-8 h-8 text-gray-400 inline-block" />}
                  {entry.rank === 3 && <Award className="w-8 h-8 text-orange-400 inline-block" />}
                  {entry.rank > 3 && <span className="font-bold text-lg">{entry.rank}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 text-muted-foreground border-2 border-primary/20">
                      <AvatarImage src={entry.avatarUrl || undefined} alt={displayName}/>
                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">ID: {(entry.inGameUID || entry.userId).substring(0, 8)}...</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center text-xl font-bold text-accent">{entry.kills}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </GlassCard>
  );
};

export default LeaderboardTable;
