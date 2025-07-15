
"use client";

import { useState, useEffect, useMemo } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Award, Edit, Loader2, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import type { Tournament } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import PageTitle from '@/components/core/page-title';
import { cn } from '@/lib/utils';

type TournamentStatusFilter = "all" | "upcoming" | "live" | "completed" | "archived";

export default function AdminManageResultsPage() {
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TournamentStatusFilter>('all');

  useEffect(() => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const tournamentsRef = ref(database, 'tournaments');
    const listener = onValue(tournamentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedTournaments: Tournament[] = Object.keys(data).map(id => ({
          id,
          ...data[id],
          joinedPlayersCount: data[id].playersJoined ? Object.keys(data[id].playersJoined).length : 0,
        })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setAllTournaments(loadedTournaments);
      } else {
        setAllTournaments([]);
      }
      setIsLoading(false);
    }, (errorObject: Error) => {
      console.error("Error fetching tournaments for results page:", errorObject);
      toast({ title: "Fetch Error", description: "Could not load tournaments for results management.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      if (database) {
        off(tournamentsRef, 'value', listener);
      }
    };
  }, [toast]);

  const displayedTournaments = useMemo(() => {
    let filtered = [...allTournaments];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(lowerSearchTerm) ||
        t.game.toLowerCase().includes(lowerSearchTerm)
      );
    }
    return filtered;
  }, [allTournaments, searchTerm, statusFilter]);

  const statusFilters: { label: string; value: TournamentStatusFilter }[] = [
    { label: "All Statuses", value: "all" },
    { label: "Upcoming", value: "upcoming" },
    { label: "Live", value: "live" },
    { label: "Completed", value: "completed" },
    { label: "Archived", value: "archived" },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Loading tournaments...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-8">
      <PageTitle
        title="Manage Tournament Results"
        subtitle="Select a tournament to input scores, finalize standings, and publish results."
      />
      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30 space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or game..."
              className="pl-10 w-full bg-input/50 border-border/70 focus:border-accent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="w-full whitespace-nowrap rounded-md">
            <div className="flex w-max space-x-2 pb-2">
              {statusFilters.map(filter => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "shrink-0",
                    statusFilter === filter.value && "neon-accent-bg text-primary-foreground",
                    statusFilter !== filter.value && "border-border/50 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  <Filter className="mr-2 h-3 w-3 opacity-70" />
                  {filter.label}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <div className="relative flex-1">
          <ScrollArea className="absolute inset-0">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                  <TableHead>Tournament Name</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Players</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTournaments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No tournaments match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedTournaments.map((t) => (
                    <TableRow key={t.id} className="border-b-border/20 hover:bg-muted/20">
                      <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.game}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={t.status === 'upcoming' ? 'secondary' : t.status === 'live' ? 'destructive' : t.status === 'completed' ? 'default' : 'outline'}
                          className={cn(
                            t.status === 'live' && 'animate-pulse',
                            t.status === 'upcoming' && 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                            t.status === 'completed' && 'bg-green-500/20 text-green-300 border-green-500/30',
                            t.status === 'archived' && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{t.joinedPlayersCount || 0} / {t.maxPlayers}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.startTime ? format(parseISO(t.startTime), "dd MMM, hh:mm a") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="sm" asChild className="border-accent text-accent hover:bg-accent/10">
                          <Link href={`/admin/tournaments/results/${t.id}`}>
                            <Edit className="mr-2 h-4 w-4" /> Manage Scores
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </GlassCard>
    </div>
  );
}
