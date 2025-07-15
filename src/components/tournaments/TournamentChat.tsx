
"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, push, serverTimestamp, query, limitToLast } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage, Tournament } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, BadgeCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '../ui/badge';

interface TournamentChatProps {
  tournament: Tournament;
}

export default function TournamentChat({ tournament }: TournamentChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!database || !tournament.id) {
      setIsLoading(false);
      return;
    }

    const messagesRef = query(ref(database, `tournamentChats/${tournament.id}`), limitToLast(200));
    
    const messagesListener = onValue(messagesRef, (snapshot) => {
      const loadedMessages: ChatMessage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          loadedMessages.push({ id: childSnapshot.key!, ...childSnapshot.val() });
        });
      }
      setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
      setIsLoading(false);
    }, (error) => {
      console.error(`Error fetching chat for tournament ${tournament.id}:`, error);
      setIsLoading(false);
    });

    return () => {
      off(messagesRef, 'value', messagesListener);
    };
  }, [tournament.id]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setIsSending(true);
    try {
      const messageData = {
        senderUid: user.id,
        senderUsername: user.username,
        senderAvatar: user.avatarUrl || null,
        message: newMessage,
        timestamp: serverTimestamp(),
        isAdmin: user.role === 'admin',
      };
      await push(ref(database, `tournamentChats/${tournament.id}`), messageData);
      setNewMessage('');
    } catch (error: any) {
      toast({ title: "Send Error", description: error.message || "Could not send message.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };
    
  return (
    <div className="flex flex-col h-full bg-transparent">
        <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin h-6 w-6 text-accent"/></div>
                ) : messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-sm text-muted-foreground">No messages yet. Be the first!</div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2.5">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.senderAvatar || undefined} />
                                <AvatarFallback>{(msg.senderUsername || 'U').charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start max-w-[80%]">
                                <div className="text-xs text-muted-foreground px-1 mb-0.5 flex items-center gap-1">
                                    {msg.senderUsername || 'Unknown User'}
                                    {msg.isAdmin && <BadgeCheck className="h-3 w-3 text-accent" title="Admin"/>}
                                </div>
                                <div className="px-3 py-1.5 rounded-xl break-words bg-muted text-sm text-foreground rounded-tl-none">
                                    {msg.message}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
        <div className="p-2 border-t border-border/50 bg-background/50">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-input/50 border-border/70 focus:border-accent h-9 text-sm"
                    disabled={isSending}
                />
                <Button type="submit" size="sm" disabled={isSending || !newMessage.trim()} className="neon-accent-bg h-9">
                    {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
            </form>
        </div>
    </div>
  );
}
