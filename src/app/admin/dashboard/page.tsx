
"use client";

import { useState, useEffect } from 'react';
import GlassCard from '@/components/core/glass-card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, UserPlus, DownloadCloud, Hourglass, Loader2, Trash, UserCircle, LogOut, Wallet, Activity } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { database, auth } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo, limitToLast, remove, onValue, off } from 'firebase/database';
import type { Tournament, WithdrawRequest, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface StatData {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  href: string;
}

interface ActivityItem {
  id: string;
  type: 'user_registration' | 'withdrawal_request';
  timestamp: string; // ISO string
  description: string;
  icon: React.ElementType;
  link?: string;
}

const initialStats: StatData[] = [
  { title: 'Total Users', value: '0', icon: Users, color: 'text-blue-400', href: '/admin/users' },
  { title: 'Active Users', value: '0', icon: Activity, color: 'text-teal-400', href: '/admin/users' },
  { title: 'Active Tournaments', value: '0', icon: Gamepad2, color: 'text-green-400', href: '/admin/tournaments' },
  { title: 'Pending Withdrawals', value: '0', icon: RupeeIcon, color: 'text-red-400', href: '/admin/withdrawals' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatData[]>(initialStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchOtherData = async () => {
      if (!database) return;
      setIsLoadingActivities(true);

      try {
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        let totalUsers = 0;
        if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            totalUsers = Object.keys(usersData).length;
        }
        
        const pendingWithdrawalsQuery = query(ref(database, 'withdrawRequests'), orderByChild('status'), equalTo('pending'));
        const pendingWithdrawalsSnapshot = await get(pendingWithdrawalsQuery);
        const pendingWithdrawalsCount = pendingWithdrawalsSnapshot.exists() ? Object.keys(pendingWithdrawalsSnapshot.val()).length : 0;
        
        setStats(prevStats => prevStats.map(stat => {
            if (stat.title === 'Total Users') return { ...stat, value: totalUsers.toLocaleString() };
            if (stat.title === 'Pending Withdrawals') return { ...stat, value: pendingWithdrawalsCount.toLocaleString() };
            return stat;
        }));

        // Fetch recent activities
        const userActivitiesList: ActivityItem[] = [];
        const recentUsersQuery = query(ref(database, 'users'), orderByChild('createdAt'), limitToLast(5));
        const recentUsersSnapshot = await get(recentUsersQuery);
        if (recentUsersSnapshot.exists()) {
          const usersData = recentUsersSnapshot.val() as Record<string, User>;
          Object.entries(usersData).forEach(([id, user]) => {
            if (user.createdAt && typeof user.createdAt === 'string') {
              userActivitiesList.push({
                id: `user-${id}`, type: 'user_registration', timestamp: user.createdAt,
                description: `User '${user.username || 'N/A'}' registered.`, icon: UserPlus,
              });
            }
          });
        }

        const withdrawalActivitiesList: ActivityItem[] = [];
        const recentWithdrawalsQuery = query(ref(database, 'withdrawRequests'), orderByChild('requestDate'), limitToLast(5));
        const recentWithdrawalsSnapshot = await get(recentWithdrawalsQuery);
        if (recentWithdrawalsSnapshot.exists()) {
          const withdrawalsData = recentWithdrawalsSnapshot.val() as Record<string, WithdrawRequest>;
          Object.entries(withdrawalsData).forEach(([id, req]) => {
            if (req.requestDate && typeof req.requestDate === 'string') {
              withdrawalActivitiesList.push({
                id: `withdrawal-${id}`, type: 'withdrawal_request', timestamp: req.requestDate,
                description: `Withdrawal of Rs ${Number(req.amount || 0).toFixed(2)} by '${req.username || 'N/A'}' (${req.status}).`,
                icon: req.status === 'pending' ? Hourglass : DownloadCloud,
              });
            }
          });
        }

        const combinedActivities = [...userActivitiesList, ...withdrawalActivitiesList]
          .filter(activity => activity.timestamp && !isNaN(new Date(activity.timestamp).getTime()))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 7); 

        setRecentActivities(combinedActivities);
      } catch (error) {
         console.error("Error fetching non-realtime dashboard data:", error);
         toast({ title: "Dashboard Load Error", description: "Could not load some dashboard data.", variant: "destructive" });
      } finally {
        setIsLoadingActivities(false);
      }
    };
    
    fetchOtherData();

    // Set up real-time listeners
    if (!database) {
      toast({ title: "Database Error", description: "Firebase database not initialized.", variant: "destructive" });
      setIsLoadingStats(false);
      return;
    }

    const liveTournamentsQuery = query(ref(database, 'tournaments'), orderByChild('status'), equalTo('live'));
    const tournamentsListener = onValue(liveTournamentsQuery, (snapshot) => {
        const activeTournamentsCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        setStats(prevStats => prevStats.map(stat => 
            stat.title === 'Active Tournaments' ? { ...stat, value: activeTournamentsCount.toLocaleString() } : stat
        ));
        setIsLoadingStats(false);
    }, (error) => {
        console.error("Error fetching live tournaments:", error);
        toast({ title: "Live Data Error", description: "Could not get real-time tournament count.", variant: "destructive" });
    });

    const activeUsersQuery = query(ref(database, 'users'), orderByChild('isOnline'), equalTo(true));
    const activeUsersListener = onValue(activeUsersQuery, (snapshot) => {
        const activeUsersCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        setStats(prevStats => prevStats.map(stat => 
            stat.title === 'Active Users' ? { ...stat, value: activeUsersCount.toLocaleString() } : stat
        ));
    }, (error) => {
        console.error("Error fetching active users:", error);
        toast({ title: "Live Data Error", description: "Could not get real-time active user count.", variant: "destructive" });
    });

    // Cleanup listeners on component unmount
    return () => {
        off(liveTournamentsQuery, 'value', tournamentsListener);
        off(activeUsersQuery, 'value', activeUsersListener);
    };

  }, [toast]);

  const renderTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return <span className="text-red-500">Invalid date</span>;
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      console.warn("Error formatting date for activity:", timestamp, e);
      return <span className="text-red-500">Date error</span>;
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    // This function now only removes the item from the local state (the view).
    // It does NOT delete the underlying data from Firebase.
    setRecentActivities(currentActivities =>
      currentActivities.filter(activity => activity.id !== activityId)
    );
    toast({
      title: "Activity Hidden",
      description: "The activity has been hidden from this view.",
      variant: "default",
    });
  };

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">Admin Dashboard</h1>
      </div>
      {isLoadingStats ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array(4).fill(0).map((_, index) => (
            <GlassCard key={index} className="p-0 overflow-hidden h-36 animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-5 w-5 bg-muted rounded-full"></div>
                </CardHeader>
                <CardContent>
                    <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                </CardContent>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <GlassCard key={stat.title} className="p-0 overflow-hidden">
              <Link href={stat.href} className="block hover:bg-muted/10 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground pt-1">View Details</p>
                </CardContent>
              </Link>
            </GlassCard>
          ))}
        </div>
      )}
      
      <GlassCard>
        <h3 className="text-xl font-semibold mb-4 text-foreground">Recent Activity</h3>
        {isLoadingActivities ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="ml-3 text-muted-foreground">Loading activities...</p>
          </div>
        ) : recentActivities.length > 0 ? (
          <ScrollArea className="h-80">
            <ul className="space-y-3 pr-2">
              {recentActivities.map((activity) => (
                <li key={activity.id} className="flex items-start space-x-3 p-3 bg-background/30 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors">
                  <activity.icon className="h-6 w-6 text-accent mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground leading-snug">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {renderTimestamp(activity.timestamp)}
                    </p>
                  </div>
                  <Button variant='ghost' size='sm' onClick={() => handleDeleteActivity(activity.id)} className="shrink-0 ml-auto">
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <Hourglass className="mx-auto h-12 w-12 mb-3 text-muted-foreground/50" />
            No recent activity found to display.
          </div>
        )}
      </GlassCard>
    </div>
  );
}
