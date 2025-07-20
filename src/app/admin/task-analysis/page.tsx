
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { WalletTransaction, User } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Loader2, TrendingUp, Activity, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClickLogEntry {
    id: string;
    task: string;
    timestamp: number;
    user: {
        id: string;
        username: string;
        avatarUrl: string | null;
    } | null;
}

const StatDisplay: React.FC<{ icon: React.ElementType, title: string, value: string | number }> = ({ icon: Icon, title, value }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-background/50 rounded-lg text-center h-full">
        <Icon className="h-8 w-8 text-accent mb-2" />
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground mt-1">{title}</span>
    </div>
);

const getTaskDisplayName = (taskKey: string): string => {
    return taskKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function TaskAnalysisPage() {
    const [clickStats, setClickStats] = useState<Record<string, number>>({});
    const [liveClicks, setLiveClicks] = useState<ClickLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cachedUsers, setCachedUsers] = useState<Record<string, { username: string; avatarUrl: string | null }>>({});

    useEffect(() => {
        if (!database) {
            setError("Database service is not available.");
            setIsLoading(false);
            return;
        }

        const clicksRef = ref(database, 'adminData/taskClicks');
        const liveClicksRef = query(ref(database, 'adminData/liveTaskClicks'), limitToLast(50));

        const clicksListener = onValue(clicksRef, (snapshot) => {
            setClickStats(snapshot.exists() ? snapshot.val() : {});
        }, (err) => {
            console.error("Error fetching click stats:", err);
            setError("Could not load aggregate click data.");
        });

        const liveClicksListener = onValue(liveClicksRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setLiveClicks([]);
                setIsLoading(false);
                return;
            }

            const data = snapshot.val();
            const loadedClicks: Omit<ClickLogEntry, 'user'>[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            
            const userIdsToFetch = new Set<string>();
            loadedClicks.forEach(click => {
                if (click.userId && !cachedUsers[click.userId]) {
                    userIdsToFetch.add(click.userId);
                }
            });

            const newUsers: Record<string, { username: string; avatarUrl: string | null }> = {};
            if (userIdsToFetch.size > 0) {
                const userFetchPromises = Array.from(userIdsToFetch).map(uid => 
                    get(ref(database, `users/${uid}`)).then(snap => ({ uid, data: snap.val() }))
                );
                const results = await Promise.all(userFetchPromises);
                results.forEach(({ uid, data }) => {
                    newUsers[uid] = { username: data?.username || `User ${uid.slice(0, 4)}`, avatarUrl: data?.avatarUrl || null };
                });
                setCachedUsers(prev => ({ ...prev, ...newUsers }));
            }
            
            const clicksWithUserData = loadedClicks.map((click): ClickLogEntry => {
                const userProfile = cachedUsers[click.userId] || newUsers[click.userId];
                return {
                    ...click,
                    user: userProfile ? { id: click.userId, ...userProfile } : null
                };
            }).sort((a, b) => b.timestamp - a.timestamp);

            setLiveClicks(clicksWithUserData);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching live clicks:", err);
            setError("Could not load live user click feed.");
            setIsLoading(false);
        });
        
        return () => {
            off(clicksRef, 'value', clicksListener);
            off(liveClicksRef, 'value', liveClicksListener);
        };
    }, [cachedUsers]);

    const totalClicks = Object.values(clickStats).reduce((sum, count) => sum + count, 0);
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /><p className="ml-3">Analyzing task data...</p></div>;
    }
  
    if (error) {
        return <GlassCard className="p-10 text-center text-destructive"><p>{error}</p></GlassCard>;
    }
    
    return (
        <div className="space-y-8">
            <PageTitle title="Task & Click Analysis" subtitle="Overview of user engagement with earning tasks." />
            
            <GlassCard>
                <h3 className="text-xl font-semibold text-foreground mb-4">Click Engagement Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatDisplay icon={TrendingUp} title="Total Clicks (All Tasks)" value={totalClicks.toLocaleString()} />
                    {Object.entries(clickStats).map(([key, value]) => (
                        <StatDisplay 
                            key={key}
                            icon={Activity}
                            title={getTaskDisplayName(key)}
                            value={value.toLocaleString()}
                        />
                    ))}
                </div>
            </GlassCard>
            
            <GlassCard className="p-0">
                <div className="p-4 border-b border-border/30">
                    <h3 className="text-lg font-semibold text-foreground">Live User Clicks</h3>
                    <p className="text-sm text-muted-foreground">Most recent user interactions with tasks.</p>
                </div>
                <ScrollArea className="h-96">
                    {liveClicks.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Task</TableHead>
                                    <TableHead className="text-right">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {liveClicks.map(click => (
                                    <TableRow key={click.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border-2 border-primary/20">
                                                    <AvatarImage src={click.user?.avatarUrl || undefined} />
                                                    <AvatarFallback>
                                                        {click.user ? click.user.username.charAt(0) : <UserCircle />}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>{click.user?.username || 'Unknown User'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getTaskDisplayName(click.task)}</TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(click.timestamp), { addSuffix: true })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No live click data available.
                        </div>
                    )}
                </ScrollArea>
            </GlassCard>
        </div>
    );
}
