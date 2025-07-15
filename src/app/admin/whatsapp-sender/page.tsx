
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, User } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, AlertCircle, Gamepad2, MessageSquare, Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Improved default message template
const DEFAULT_MESSAGE_TEMPLATE = 
`Hi *{username}*! 👋

A new tournament is happening on *{appName}*!

*Tournament:* {tournamentName}
*Game:* {game}
*Mode:* {mode}
*Entry Fee:* Rs {entryFee}
*Prize Pool:* Rs {prizePool}

Don't forget your login details:
*Email:* {email}
*Username:* {username}
(For password reset, please use the 'Forgot Password' option in the app.)

*More ways to earn on {appName}:*
- Watch Ads & complete tasks
- Subscribe to our YouTube channel for rewards

Join now and show your skills!
`;

export default function WhatsAppSenderPage() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appName, setAppName] = useState('Arena Ace'); // Add state for app name

  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const whatsappWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!database) {
        toast({ title: "Database Error", description: "Database not available.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      try {
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        const allUsers: User[] = [];
        if (usersSnapshot.exists()) {
            usersSnapshot.forEach(childSnapshot => {
                const userData = childSnapshot.val();
                if (userData.phone && userData.phone.trim() !== '') {
                    allUsers.push({ id: childSnapshot.key!, ...userData });
                }
            });
        }
        setUsers(allUsers);

        const tournamentsRef = ref(database, 'tournaments');
        const upcomingQuery = query(tournamentsRef, orderByChild('status'), equalTo('upcoming'));
        const liveQuery = query(tournamentsRef, orderByChild('status'), equalTo('live'));
        
        const [upcomingSnapshot, liveSnapshot] = await Promise.all([get(upcomingQuery), get(liveQuery)]);
        const allTournaments: Tournament[] = [];
        if (upcomingSnapshot.exists()) {
          upcomingSnapshot.forEach(child => { allTournaments.push({ id: child.key!, ...child.val() }); });
        }
        if (liveSnapshot.exists()) {
          liveSnapshot.forEach(child => { allTournaments.push({ id: child.key!, ...child.val() }); });
        }
        setTournaments(allTournaments.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));

        // Fetch app name
        const settingsRef = ref(database, 'globalSettings/appName');
        const settingsSnapshot = await get(settingsRef);
        if (settingsSnapshot.exists()) {
            setAppName(settingsSnapshot.val());
        }

      } catch (error: any) {
        toast({ title: "Fetch Error", description: "Could not load data.", variant: "destructive" });
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast]);
  
  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [selectedTournamentId, tournaments]);

  const handleSendMessage = (user: User) => {
    if (!selectedTournament) {
      toast({ title: "No Tournament Selected", description: "Please select a tournament first.", variant: "destructive" });
      return;
    }
    if (!user.phone) {
        toast({ title: "No Phone Number", description: `User ${user.username} does not have a phone number.`, variant: "destructive" });
        return;
    }

    // Replace all placeholders
    let message = messageTemplate
      .replace(/{username}/g, user.username)
      .replace(/{appName}/g, appName)
      .replace(/{email}/g, user.email)
      .replace(/{tournamentName}/g, selectedTournament.name)
      .replace(/{game}/g, selectedTournament.game)
      .replace(/{mode}/g, selectedTournament.mode)
      .replace(/{entryFee}/g, String(selectedTournament.entryFee))
      .replace(/{prizePool}/g, String(selectedTournament.prizePool));
    
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = user.phone.replace(/\D/g, ''); // Remove non-digit characters
    const url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    const windowName = 'whatsappSenderPopup';
    const windowFeatures = 'width=800,height=700,scrollbars=yes,resizable=yes';

    // Check if the window is already open and not closed by the user
    if (whatsappWindowRef.current && !whatsappWindowRef.current.closed) {
        whatsappWindowRef.current.location.href = url;
        whatsappWindowRef.current.focus(); // Bring the existing window to the front
    } else {
        // Open a new window and store its reference
        const newWindow = window.open(url, windowName, windowFeatures);
        if (newWindow) {
             whatsappWindowRef.current = newWindow;
             whatsappWindowRef.current.focus();
        } else {
             // This happens if the browser blocks pop-ups
             toast({
                title: "Popup Blocked",
                description: "Your browser blocked the pop-up. Please allow pop-ups for this site and try again.",
                variant: "destructive"
             });
        }
    }
  };

  const exportToCsv = () => {
    if (users.length === 0) {
      toast({ title: "No Data", description: "There are no users to export.", variant: "destructive" });
      return;
    }
    
    // Filter users to ensure they have a phone number before mapping
    const rows = users
      .filter(user => user.phone && user.phone.trim() !== '')
      .map(user => [
        `"${user.username.replace(/"/g, '""')}"`, // Handle quotes in username
        user.phone
    ]);

    if (rows.length === 0) {
        toast({ title: "No Phone Numbers", description: "No users in the list have a registered phone number.", variant: "destructive" });
        return;
    }

    const headers = ['Username', 'Phone Number'];
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "user_phone_numbers.csv");
    document.body.appendChild(link); // Required for Firefox

    link.click();
    document.body.removeChild(link);

    toast({ title: "Exported!", description: `${rows.length} user phone numbers have been downloaded as a CSV file.` });
  };

  return (
    <div className="space-y-6">
      <PageTitle title="WhatsApp Sender" subtitle="Manually send tournament notifications to users." />
      
      {isLoading ? (
        <GlassCard className="p-6 flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="ml-3 text-muted-foreground">Loading data...</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <GlassCard className="p-4">
              <Label htmlFor="tournament-select" className="flex items-center gap-2 mb-2 text-muted-foreground"><Gamepad2 className="h-4 w-4"/> 1. Select Tournament</Label>
              <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                <SelectTrigger id="tournament-select">
                  <SelectValue placeholder="Choose a match to announce" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  {tournaments.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GlassCard>
            <GlassCard className="p-4">
              <Label htmlFor="message-template" className="flex items-center gap-2 mb-2 text-muted-foreground"><MessageSquare className="h-4 w-4"/> 2. Customize Message</Label>
              <Textarea
                id="message-template"
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                className="h-72 font-mono text-xs bg-input/50"
              />
               <p className="text-xs text-muted-foreground mt-2">Placeholders: {`{username}, {email}, {appName}, etc.`}</p>
            </GlassCard>
          </div>
          <div className="lg:col-span-2">
            <GlassCard className="p-0 flex flex-col h-[75vh]">
                <div className="p-4 border-b border-border/30 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">3. Send to Users ({users.length} with numbers)</h3>
                    <Button variant="outline" size="sm" onClick={exportToCsv} disabled={users.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Export Numbers
                    </Button>
                </div>
                <div className="flex-1 relative">
                    <ScrollArea className="absolute inset-0">
                    <Table className="min-w-[500px]">
                        <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Phone Number</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border-2 border-primary/20">
                                                <AvatarImage src={user.avatarUrl || undefined} />
                                                <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{user.username}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground">{user.phone}</TableCell>
                                    <TableCell className="text-center">
                                        <Button size="sm" onClick={() => handleSendMessage(user)} disabled={!selectedTournamentId}>
                                            <Send className="mr-2 h-4"/>
                                            Send
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </GlassCard>
          </div>
        </div>
      )}
       <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">How this works</AlertTitle>
          <AlertDescription className="!text-primary/80">
            This tool uses your device's WhatsApp to send messages. Clicking "Send" will open WhatsApp Web or the desktop app with a pre-filled message. You must manually press send in WhatsApp. This process is not automated to comply with WhatsApp's policies and keep your number safe.
          </AlertDescription>
        </Alert>
    </div>
  );
}
