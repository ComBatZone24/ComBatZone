
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, query, orderByChild, equalTo, onValue, off, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, MessageSquare as WhatsappIcon, Users, Mail } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DelegateContact extends User {
    tempWhatsappNumber: string;
}

export default function DelegateContactsPage() {
    const [delegates, setDelegates] = useState<DelegateContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    useEffect(() => {
        if (!database) {
            toast({ title: "Database Error", description: "Database service not available.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const delegatesQuery = query(ref(database, 'users'), orderByChild('role'), equalTo('delegate'));
        const listener = onValue(delegatesQuery, (snapshot) => {
            const loadedDelegates: DelegateContact[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const userData = childSnapshot.val();
                    loadedDelegates.push({
                        id: childSnapshot.key!,
                        ...userData,
                        tempWhatsappNumber: userData.whatsappNumber || ''
                    });
                });
            }
            setDelegates(loadedDelegates.sort((a, b) => a.username.localeCompare(b.username)));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching delegates:", error);
            toast({ title: "Fetch Error", description: "Could not load delegate data.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => off(delegatesQuery, 'value', listener);
    }, [toast]);

    const handleNumberChange = (userId: string, value: string) => {
        setDelegates(prev => 
            prev.map(d => d.id === userId ? { ...d, tempWhatsappNumber: value } : d)
        );
    };

    const handleSaveNumber = async (userId: string) => {
        const delegate = delegates.find(d => d.id === userId);
        if (!delegate) return;

        setSavingStates(prev => ({ ...prev, [userId]: true }));
        try {
            const userRef = ref(database, `users/${userId}`);
            await update(userRef, { whatsappNumber: delegate.tempWhatsappNumber || null });
            toast({ title: "Success", description: `WhatsApp number for ${delegate.username} has been updated.`, className: "bg-green-500/20" });
        } catch (error: any) {
            toast({ title: "Save Error", description: `Could not save number: ${error.message}`, variant: "destructive" });
        } finally {
            setSavingStates(prev => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <div className="flex h-full flex-col space-y-6">
            <PageTitle title="Delegate Contact Management" subtitle="Quickly view and update WhatsApp numbers for your delegates." />
            
            <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
                <div className="p-4 border-b border-border/30">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                        <Users className="mr-2 h-5 w-5 text-accent" /> All Delegates
                    </h3>
                </div>
                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <p className="ml-3 text-muted-foreground">Loading delegates...</p>
                    </div>
                ) : delegates.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">No delegates found.</div>
                ) : (
                    <ScrollArea className="flex-1">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>WhatsApp Number</TableHead>
                                    <TableHead className="w-[120px] text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {delegates.map(delegate => (
                                    <TableRow key={delegate.id} className="hover:bg-muted/20">
                                        <TableCell className="font-semibold text-foreground">{delegate.username}</TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs">{delegate.email || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="relative">
                                                <WhatsappIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="tel"
                                                    placeholder="e.g. 923001234567"
                                                    value={delegate.tempWhatsappNumber}
                                                    onChange={(e) => handleNumberChange(delegate.id, e.target.value)}
                                                    className="pl-8 bg-input/50"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button size="sm" onClick={() => handleSaveNumber(delegate.id)} disabled={savingStates[delegate.id]}>
                                                {savingStates[delegate.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </GlassCard>
        </div>
    );
}

