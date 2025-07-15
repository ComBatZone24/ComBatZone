
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@/lib/firebase/config";
import { ref, set, onValue, off, update, remove, get } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageTitle from "@/components/core/page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle, Edit3, Trash2, Save, BarChart3, User, Gamepad2, Target, UserCircle } from "lucide-react";
import type { LeaderboardEntry as AppLeaderboardEntry } from "@/types";
import GlassCard from "@/components/core/glass-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const leaderboardEntrySchema = z.object({
  inGameUID: z.string().min(1, "In-Game UID is required."),
  inGameName: z.string().min(1, "In-Game Name is required."),
  kills: z.coerce.number().min(0, "Kills must be a non-negative number."),
});

type LeaderboardFormValues = z.infer<typeof leaderboardEntrySchema>;
type LeaderboardEntry = AppLeaderboardEntry & { kills: number; avatarUrl?: string | null };

type LeaderboardDbEntry = {
    inGameUID: string;
    inGameName: string;
    kills: number;
    username?: string;
    avatarUrl?: string | null;
}

export default function ManageLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LeaderboardEntry | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<LeaderboardEntry | null>(null);

  const form = useForm<LeaderboardFormValues>({
    resolver: zodResolver(leaderboardEntrySchema),
    defaultValues: {
      inGameUID: "",
      inGameName: "",
      kills: 0,
    },
  });

  useEffect(() => {
    if (!database) return;
    const leaderboardRef = ref(database, 'leaderboards');
    const listener = onValue(leaderboardRef, (snapshot) => {
      const data = snapshot.val();
      const loadedEntries: LeaderboardEntry[] = [];
      if (data) {
        Object.keys(data).forEach(key => {
          const entryData = data[key];
          loadedEntries.push({ 
              userId: key,
              inGameUID: entryData.inGameUID || key,
              inGameName: entryData.inGameName,
              username: entryData.username || entryData.inGameName,
              kills: entryData.kills || 0,
              rank: 0,
              avatarUrl: entryData.avatarUrl || null,
          });
        });
      }
      const sortedEntries = loadedEntries
        .sort((a, b) => b.kills - a.kills)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      setEntries(sortedEntries);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      toast({ title: "Fetch Error", description: "Could not load leaderboard entries.", variant: "destructive" });
      setLoading(false);
    });
    return () => off(leaderboardRef, 'value', listener);
  }, [toast]);

  const openCreateDialog = () => {
    setEditingEntry(null);
    form.reset({
      inGameUID: "",
      inGameName: "",
      kills: 0,
    });
    setIsFormDialogOpen(true);
  };
  
  const openEditDialog = (entry: LeaderboardEntry) => {
    setEditingEntry(entry);
    form.reset({
      inGameUID: entry.inGameUID,
      inGameName: entry.inGameName,
      kills: entry.kills,
    });
    setIsFormDialogOpen(true);
  };

  const onSubmit = async (data: LeaderboardFormValues) => {
    if (!database) {
      toast({ title: "Database Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }

    try {
      const entryRef = ref(database, `leaderboards/${data.inGameUID}`);

      if (!editingEntry) {
        const existingEntrySnap = await get(entryRef);
        if (existingEntrySnap.exists()) {
            toast({ title: "UID Exists", description: "A player with this In-Game UID already exists on the leaderboard.", variant: "destructive" });
            return;
        }
      }

      const newEntryData: LeaderboardDbEntry = {
        inGameUID: data.inGameUID,
        inGameName: data.inGameName,
        kills: data.kills,
      };

      await set(entryRef, newEntryData);
      
      toast({ title: "Success", description: `Leaderboard entry for ${data.inGameName} has been saved.` });
      form.reset();
      setIsFormDialogOpen(false);
      setEditingEntry(null);

    } catch (error: any) {
      console.error("Error saving leaderboard entry:", error);
      toast({ title: "Error", description: error.message || "Failed to save entry.", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    try {
      await remove(ref(database, `leaderboards/${entryToDelete.inGameUID}`));
      toast({ title: "Deleted", description: `Entry for ${entryToDelete.inGameName} successfully deleted.` });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete entry.", variant: "destructive" });
    }
  };

  const LeaderboardForm = ({ isEditMode }: { isEditMode: boolean }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="inGameUID" render={({ field }) => (
          <FormItem><FormLabel><Gamepad2 className="inline mr-2 h-4"/>In-Game UID</FormLabel><FormControl><Input placeholder="Enter unique in-game identifier" {...field} disabled={isEditMode} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="inGameName" render={({ field }) => (
          <FormItem><FormLabel><User className="inline mr-2 h-4"/>In-Game Name</FormLabel><FormControl><Input placeholder="Enter player's name" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="kills" render={({ field }) => (
          <FormItem><FormLabel><Target className="inline mr-2 h-4"/>Total Kills</FormLabel><FormControl><Input type="number" placeholder="Enter total kills" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            {isEditMode ? "Save Changes" : "Add Player"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <>
      <div className="flex h-full flex-col space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageTitle title="Leaderboard Management" subtitle="Manually add, edit, or remove players from the leaderboard."/>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add Player</Button>
        </div>
        <GlassCard className="p-0 flex flex-1 flex-col">
          <CardHeader>
            <CardTitle>Leaderboard Entries</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> :
              entries.length === 0 ? <p className="text-center text-muted-foreground py-10">No leaderboard entries yet.</p> :
              <div className="relative flex-1">
                 <ScrollArea className="absolute inset-0">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] text-center">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>In-Game UID</TableHead>
                        <TableHead className="text-center">Kills</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map(entry => {
                        const displayName = entry.inGameName || entry.username || "Player";
                        return (
                        <TableRow key={entry.inGameUID}>
                          <TableCell className="text-center font-bold text-lg">{entry.rank}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10 text-muted-foreground border-2 border-primary/20">
                                    <AvatarImage src={entry.avatarUrl || undefined} alt={displayName}/>
                                    <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                <p className="font-semibold text-foreground">{displayName}</p>
                                {entry.username && entry.username !== displayName && <p className="text-xs text-muted-foreground">{entry.username}</p>}
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.inGameUID}</TableCell>
                          <TableCell className="text-center font-bold text-lg text-accent">{entry.kills}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(entry)}><Edit3 className="h-4 w-4 text-yellow-400"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEntryToDelete(entry); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-red-400"/></Button>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            }
          </CardContent>
        </GlassCard>
      </div>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingEntry ? "Edit Leaderboard Entry" : "Add New Player"}</DialogTitle></DialogHeader>
          <LeaderboardForm isEditMode={!!editingEntry} />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the entry for "{entryToDelete?.inGameName}". This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
