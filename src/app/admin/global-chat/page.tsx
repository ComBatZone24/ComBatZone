
"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, push, serverTimestamp, query, limitToLast, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Trash2, Settings } from 'lucide-react';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function AdminGlobalChatPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!database) {
            setIsLoading(false);
            return;
        }

        const messagesRef = query(ref(database, 'globalChat'), limitToLast(200));
        
        const messagesListener = onValue(messagesRef, (snapshot) => {
            const loadedMessages: ChatMessage[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    loadedMessages.push({ id: childSnapshot.key!, ...childSnapshot.val() });
                });
            }
            setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
            setIsLoading(false);
        });

        return () => {
            off(messagesRef, 'value', messagesListener);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
                isAdmin: true,
            };
            await push(ref(database, 'globalChat'), messageData);
            setNewMessage('');
        } catch (error: any) {
            toast({ title: "Send Error", description: error.message || "Could not send message.", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleDeleteMessage = async (messageId: string) => {
        if (!database) return;
        await remove(ref(database, `globalChat/${messageId}`));
    };
    
    return (
        <div className="pt-8 flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <PageTitle title="Global Chat Moderation" subtitle="View and manage the community chat." />
                 <Button variant="outline" asChild>
                    <Link href="/admin/settings/general">
                        <Settings className="mr-2 h-4 w-4" /> Enable/Disable Chat
                    </Link>
                </Button>
            </div>
            <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden mt-6">
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                     {isLoading ? (
                        <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin h-8 w-8 text-accent"/></div>
                     ) : messages.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-muted-foreground">No messages yet.</div>
                     ) : (
                        messages.map(msg => (
                            <div key={msg.id} className="flex items-start gap-3 group">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={msg.senderAvatar || undefined} />
                                    <AvatarFallback>{(msg.senderUsername || 'U').charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start flex-1">
                                    <div className="text-xs text-muted-foreground px-1 mb-0.5">
                                        {msg.senderUsername || 'Unknown User'}
                                        {msg.isAdmin && <Badge variant="destructive" className="ml-2 text-xs">Admin</Badge>}
                                    </div>
                                    <div className="px-4 py-2 rounded-2xl max-w-xs md:max-w-md break-words bg-muted rounded-bl-none">
                                        {msg.message}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteMessage(msg.id)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))
                     )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-border/50 bg-background/50">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                        <Input 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type an admin message..."
                            className="bg-input/50 border-border/70 focus:border-accent"
                            disabled={isSending}
                        />
                        <Button type="submit" disabled={isSending || !newMessage.trim()} className="neon-accent-bg">
                            {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
            </GlassCard>
        </div>
    );
}
