
"use client";

import { useState, useEffect, useMemo } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Trash2, Search, Eye, Loader2, Users as UsersIcon, Filter } from 'lucide-react';
import Link from 'next/link';
import type { Tournament, TournamentPlayer } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentDelete, // Alias to avoid conflict
  AlertDialogDescription as AlertDialogDescriptionDelete,
  AlertDialogFooter as AlertDialogFooterDelete,
  AlertDialogHeader as AlertDialogHeaderDelete,
  AlertDialogTitle as AlertDialogTitleDelete,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PageTitle from '@/components/core/page-title';

type TournamentStatus = "upcoming" | "live" | "completed" | "archived" | "all";

export default function AdminTournamentsPage() {
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TournamentStatus>('all');

  const [isDeleting, setIsDeleting] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [viewingPlayersTournament, setViewingPlayersTournament] = useState<Tournament | null>(null);
  const [isPlayersDialogOpen, setIsPlayersDialogOpen] = useState(false);


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
          playersJoined: data[id].playersJoined || {}, // Ensure playersJoined is an object
          joinedPlayersCount: data[id].playersJoined ? Object.keys(data[id].playersJoined).length : 0,
        })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setAllTournaments(loadedTournaments);
      } else {
        setAllTournaments([]);
      }
      setIsLoading(false);
    }, (errorObject: Error) => { 
      console.error("Error fetching tournaments:", errorObject);
      let description = "Could not load tournaments.";
      if (errorObject.message && errorObject.message.toLowerCase().includes('permission_denied')) {
        description = "Permission Denied. Please check your Firebase Realtime Database security rules to allow admins to read /tournaments.";
      }
      toast({ title: "Fetch Error", description, variant: "destructive" });
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

  const statusFilters: { label: string; value: TournamentStatus }[] = [
    { label: "All", value: "all" },
    { label: "Upcoming", value: "upcoming" },
    { label: "Live", value: "live" },
    { label: "Completed", value: "completed" },
    { label: "Archived", value: "archived" },
  ];

  const handleDeleteTournament = async () => {
    if (!tournamentToDelete || !tournamentToDelete.id || !database) {
      toast({ title: "Error", description: "No tournament selected or database error.", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    try {
      await remove(ref(database, `tournaments/${tournamentToDelete.id}`));
      await remove(ref(database, `tournamentChats/${tournamentToDelete.id}`));
      toast({
        title: "Tournament Deleted",
        description: `"${tournamentToDelete.name}" and its chat have been successfully deleted.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      setIsDeleteDialogOpen(false);
      setTournamentToDelete(null);
    } catch (error: any) {
      console.error("Error deleting tournament:", error);
      let description = "Could not delete tournament.";
      if (String(error.message).toUpperCase().includes("PERMISSION_DENIED")) {
        description = "Permission Denied. Check Firebase rules for deleting from /tournaments and /tournamentChats.";
      }
      toast({ title: "Deletion Failed", description, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Loading tournaments...</p>
      </div>
    );
  }

  const handleOpenPlayersDialog = (tournament: Tournament) => {
    setViewingPlayersTournament(tournament);
    setIsPlayersDialogOpen(true);
  };

  return (
    <div className="flex h-full flex-col space-y-6">
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteDialogOpen(isOpen);
          if (!isOpen) {
            setTournamentToDelete(null);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageTitle title="Tournament Management" subtitle="Create, view, and manage all tournaments." />
          <Button className="neon-accent-bg w-full sm:w-auto" asChild>
            <Link href="/admin/tournaments/create">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Tournament
            </Link>
          </Button>
        </div>

        <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
          <div className="p-4 border-b border-border/30 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative w-full sm:flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name or game..."
                  className="pl-10 w-full bg-input/50 border-border/70 focus:border-accent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
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
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                    <TableHead>Name</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Players</TableHead>
                    <TableHead className="text-right">Entry Fee</TableHead>
                    <TableHead className="text-center w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTournaments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        {allTournaments.length === 0 ? "No tournaments found." : "No tournaments match your current filters."}
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
                        <TableCell className="text-right text-muted-foreground">Rs {t.entryFee}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-accent h-8 w-8"
                              title="View Joined Players"
                              onClick={() => handleOpenPlayersDialog(t)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 h-8 w-8" asChild title="Edit Tournament">
                              <Link href={`/admin/tournaments/edit/${t.id}`}>
                                <Edit3 className="h-4 w-4" />
                              </Link>
                            </Button>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-300 h-8 w-8"
                                title="Delete Tournament"
                                onClick={() => {
                                  setTournamentToDelete(t);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
          
          <AlertDialogContentDelete className="glass-card">
            {tournamentToDelete && (
              <>
                <AlertDialogHeaderDelete>
                  <AlertDialogTitleDelete>Are you absolutely sure?</AlertDialogTitleDelete>
                  <AlertDialogDescriptionDelete>
                    This action cannot be undone. This will permanently delete the tournament
                    <span className="font-semibold text-foreground"> "{tournamentToDelete.name}"</span> and its entire chat history.
                  </AlertDialogDescriptionDelete>
                </AlertDialogHeaderDelete>
                <AlertDialogFooterDelete>
                  <AlertDialogCancel
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setTournamentToDelete(null);
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTournament} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {isDeleting ? <Loader2 className="animate-spin mr-2"/> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooterDelete>
              </>
            )}
            {!tournamentToDelete && isDeleteDialogOpen && (
               <AlertDialogHeaderDelete>
                  <AlertDialogTitleDelete>Error</AlertDialogTitleDelete>
                  <AlertDialogDescriptionDelete>No tournament selected for deletion. Please close and try again.</AlertDialogDescriptionDelete>
                   <AlertDialogFooterDelete>
                      <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Close</AlertDialogCancel>
                  </AlertDialogFooterDelete>
              </AlertDialogHeaderDelete>
            )}
          </AlertDialogContentDelete>
        </GlassCard>
      </AlertDialog>

      {/* Dialog for Viewing Players */}
      <Dialog open={isPlayersDialogOpen} onOpenChange={setIsPlayersDialogOpen}>
        <DialogContent className="glass-card sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-accent">
              Joined Players: {viewingPlayersTournament?.name || 'Tournament'} ({viewingPlayersTournament?.mode})
            </DialogTitle>
            <DialogDescription>
              List of players/teams who have joined this tournament.
              ({viewingPlayersTournament?.joinedPlayersCount || 0} / {viewingPlayersTournament?.maxPlayers || 0} slots filled)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-2">
            {viewingPlayersTournament && viewingPlayersTournament.playersJoined && Object.keys(viewingPlayersTournament.playersJoined).length > 0 ? (
              <ul className="space-y-4">
                {Object.entries(viewingPlayersTournament.playersJoined).map(([firebaseUID, playerDetails]) => (
                  <li key={firebaseUID} className="p-3 bg-background/50 rounded-lg shadow-sm border border-border/30">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-10 w-10 border-2 border-primary/30 mt-0.5">
                        <AvatarImage src={(playerDetails as any).avatarUrl || `https://placehold.co/80x80.png?text=${(playerDetails.gameName || 'P').charAt(0).toUpperCase()}`} alt={playerDetails.gameName} data-ai-hint="player avatar gaming"/>
                        <AvatarFallback>{(playerDetails.gameName || 'P').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground" title={playerDetails.gameName}>
                          {playerDetails.gameName || 'N/A'} (Player 1)
                        </p>
                        <p className="text-xs text-muted-foreground">Game UID: <span className="font-mono">{playerDetails.uid || 'N/A'}</span></p>
                        <p className="text-xs text-muted-foreground">User ID: <span className="font-mono">{firebaseUID.substring(0,10)}...</span></p>
                      </div>
                    </div>
                    {playerDetails.teamMembers && playerDetails.teamMembers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/20 space-y-1.5 pl-4">
                        <p className="text-xs font-medium text-accent mb-1">Team Members:</p>
                        {playerDetails.teamMembers.map((member, index) => (
                          <div key={index} className="ml-2 text-xs">
                            <p className="text-foreground"><span className="font-semibold">Player {index + 2}:</span> {member.gameName || 'N/A'}</p>
                            <p className="text-muted-foreground">Game UID: <span className="font-mono">{member.uid || 'N/A'}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <UsersIcon className="mx-auto h-12 w-12 mb-3 text-muted-foreground/50" />
                No players have joined this tournament yet.
              </div>
            )}
          </ScrollArea>
          <div className="mt-6 flex justify-end">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
