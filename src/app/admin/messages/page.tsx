"use client";

import React, { useEffect, useState } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, push, serverTimestamp, remove, query, orderByChild, equalTo, get } from 'firebase/database';
import { Loader2, Trash2, Send, Users, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AdminMessage {
  text: string;
  timestamp: number; // Firebase timestamp is a number
  id: string; 
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [targetUserIdentifier, setTargetUserIdentifier] = useState('');
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (!database) {
      console.warn("Firebase database is not initialized.");
      toast({ title: "Error", description: "Database not available.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const messagesRef = ref(database, 'adminMessages');
    const listener = onValue(messagesRef, (snapshot) => {
      const messagesData: AdminMessage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          messagesData.push({ id: childSnapshot.key!, ...childSnapshot.val() });
        });
      }
      
      const sortedMessages = messagesData.sort((a, b) => {
          const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
          const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
          return timeB - timeA;
      });

      setMessages(sortedMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin messages:", error);
      toast({ title: "Error", description: "Could not load messages.", variant: "destructive" });
      setLoading(false);
    });

    return () => off(messagesRef, 'value', listener);
  }, [toast]);
  
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !database) return;
    setIsSendingBroadcast(true);
    try {
      await push(ref(database, 'adminMessages'), {
        text: `[Broadcast] ${newMessageText}`,
        timestamp: serverTimestamp(),
      });
      setNewMessageText(''); 
      toast({ title: "Broadcast Sent", description: "Your message has been posted to all users.", variant: "default" });
    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast({ title: "Error", description: "Failed to send broadcast message.", variant: "destructive" });
    } finally {
      setIsSendingBroadcast(false);
    }
  };
  
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserIdentifier.trim() || !directMessageText.trim() || !database) {
      toast({ title: "Missing Information", description: "Please provide a user identifier and a message.", variant: "destructive" });
      return;
    }
    setIsSendingDirect(true);

    try {
      const usersRef = ref(database, 'users');
      let targetUid: string | null = null;
      let targetUsername: string | null = null;
      
      const emailQuery = query(usersRef, orderByChild('email'), equalTo(targetUserIdentifier));
      const emailSnapshot = await get(emailQuery);

      if (emailSnapshot.exists()) {
        targetUid = Object.keys(emailSnapshot.val())[0];
        targetUsername = emailSnapshot.val()[targetUid].username;
      } else {
        const usernameQuery = query(usersRef, orderByChild('username'), equalTo(targetUserIdentifier));
        const usernameSnapshot = await get(usernameQuery);
        if (usernameSnapshot.exists()) {
          targetUid = Object.keys(usernameSnapshot.val())[0];
          targetUsername = usernameSnapshot.val()[targetUid].username;
        }
      }

      if (!targetUid) {
        toast({ title: "User Not Found", description: "No user found with that email or username.", variant: "destructive" });
        setIsSendingDirect(false);
        return;
      }
      
      const updates: Record<string, any> = {};

      const notificationRef = ref(database, `notifications/${targetUid}`);
      const newNotificationKey = push(notificationRef).key;
      updates[`notifications/${targetUid}/${newNotificationKey}`] = {
        text: directMessageText,
        timestamp: serverTimestamp(),
        read: false,
        type: 'admin_message',
      };
      
      const adminLogText = `[Direct to: ${targetUsername}] ${directMessageText}`;
      const adminMessagesRef = ref(database, 'adminMessages');
      const newAdminMessageKey = push(adminMessagesRef).key;
      updates[`adminMessages/${newAdminMessageKey}`] = {
        text: adminLogText,
        timestamp: serverTimestamp(),
      };

      await update(ref(database), updates);

      setDirectMessageText('');
      setTargetUserIdentifier('');
      toast({ title: "Direct Message Sent", description: `Your message has been sent to ${targetUsername} and logged.`, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
    } catch (error: any) {
       console.error("Error sending direct message:", error);
       toast({ title: "Send Error", description: "Failed to send direct message.", variant: "destructive" });
    } finally {
      setIsSendingDirect(false);
    }
  };


  const handleDeleteMessage = async (messageId: string) => {
    if (!database || deletingId) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this global message?");
    if (!confirmDelete) return;

    setDeletingId(messageId);
    try {
      await remove(ref(database, `adminMessages/${messageId}`));
      toast({ title: "Message Deleted", description: "The global message has been removed.", variant: "default" });
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast({ title: "Deletion Failed", description: "Could not delete message. Check permissions.", variant: "destructive" });
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Communications Log" subtitle="Send messages and view all broadcast, direct, and system notifications." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GlassCard>
            <Tabs defaultValue="broadcast" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="broadcast"><Users className="mr-2 h-4 w-4"/>Broadcast</TabsTrigger>
                <TabsTrigger value="direct"><User className="mr-2 h-4 w-4"/>Direct Message</TabsTrigger>
            </TabsList>
            <TabsContent value="broadcast" className="pt-4">
                 <form onSubmit={handleSendBroadcast} className="flex flex-col space-y-4">
                    <Textarea
                        className="w-full p-3 rounded-md border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[150px]"
                        rows={6}
                        placeholder="Type your message to all users here..."
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        required
                    />
                    <Button
                        type="submit"
                        className="w-full neon-accent-bg"
                        disabled={!newMessageText.trim() || isSendingBroadcast}
                    >
                        {isSendingBroadcast ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Send to Everyone
                    </Button>
                </form>
            </TabsContent>
            <TabsContent value="direct" className="pt-4">
                 <form onSubmit={handleSendDirect} className="flex flex-col space-y-4">
                    <Input
                      placeholder="Enter target user's exact username or email"
                      value={targetUserIdentifier}
                      onChange={(e) => setTargetUserIdentifier(e.target.value)}
                      className="bg-background/40 border-border/60"
                      required
                    />
                    <Textarea
                        className="w-full p-3 rounded-md border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[150px]"
                        rows={6}
                        placeholder="Type your direct message here..."
                        value={directMessageText}
                        onChange={(e) => setDirectMessageText(e.target.value)}
                        required
                    />
                    <Button
                        type="submit"
                        className="w-full neon-accent-bg"
                        disabled={!targetUserIdentifier.trim() || !directMessageText.trim() || isSendingDirect}
                    >
                         {isSendingDirect ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Send Direct Message
                    </Button>
                </form>
            </TabsContent>
            </Tabs>
        </GlassCard>
        
        <GlassCard className="p-0 flex flex-col">
            <div className="p-4 border-b border-border/30">
                <h3 className="text-lg font-semibold">Communications Log</h3>
                 <p className="text-xs text-muted-foreground">This log shows all outgoing messages.</p>
            </div>
          {loading ? (
            <div className="flex-1 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : messages.length === 0 ? (
            <p className="flex-1 text-center text-muted-foreground p-10">No messages or notifications sent yet.</p>
          ) : (
            <ScrollArea className="flex-1 max-h-[450px]">
                <ul className="space-y-2 p-4">
                {messages.map((message) => (
                    <li key={message.id} className="border-b border-border/40 pb-3">
                    <p className="text-foreground mb-1">{message.text}</p>
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                            {message.timestamp ? format(new Date(message.timestamp), 'PPpp') : 'N/A'}
                        </p>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/70 hover:text-destructive"
                            onClick={() => handleDeleteMessage(message.id)}
                            disabled={!!deletingId}
                        >
                            {deletingId === message.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </div>
                    </li>
                ))}
                </ul>
            </ScrollArea>
          )}
        </GlassCard>
      </div>
       <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">Important</AlertTitle>
        <AlertDescription className="!text-primary/80 text-sm">
          Broadcast messages are visible to all users in their notification panel. Direct messages are sent only to the specified user. System notifications (like order updates) are also logged here for your reference.
        </AlertDescription>
      </Alert>
    </div>
  );
}
