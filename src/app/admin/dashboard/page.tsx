
"use client";

import { useState, useEffect } from 'react';
import GlassCard from '@/components/core/glass-card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, UserPlus, DownloadCloud, Hourglass, Loader2, Trash, UserCircle, LogOut, Wallet, Activity, TrendingUp, TrendingDown, FileText, Ticket, Save, Copy } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo, limitToLast, onValue, off, set } from 'firebase/database';
import type { Tournament, WithdrawRequest, User, WalletTransaction, RedeemCodeEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface StatData {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  description?: string;
}

interface ActivityItem {
  id: string;
  type: 'user_registration' | 'withdrawal_request';
  timestamp: string; 
  description: string;
  icon: React.ElementType;
  link?: string;
}

const initialStats: StatData[] = [
  { title: 'Total Revenue', value: 'PKR 0', icon: TrendingUp, color: 'text-green-400', description: 'Total income from fees & sales' },
  { title: 'Total Payouts', value: 'PKR 0', icon: TrendingDown, color: 'text-red-400', description: 'Prizes & withdrawals' },
  { title: 'Net Profit', value: 'PKR 0', icon: FileText, color: 'text-blue-400', description: 'Revenue minus Payouts' },
];

const initialUserStats: StatData[] = [
  { title: 'Total Users', value: '0', icon: Users, color: 'text-blue-400', href: '/admin/users' },
  { title: "Today's Registrations", value: '0', icon: UserPlus, color: 'text-purple-400', href: '/admin/users' },
  { title: 'Active Users', value: '0', icon: Activity, color: 'text-teal-400', href: '/admin/users' },
  { title: 'Active Tournaments', value: '0', icon: Gamepad2, color: 'text-green-400', href: '/admin/tournaments' },
  { title: 'Pending Withdrawals', value: '0', icon: RupeeIcon, color: 'text-red-400', href: '/admin/withdrawals' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
};

export default function AdminDashboardPage() {
  const { user: appUser } = useAuth();
  const [financialStats, setFinancialStats] = useState<StatData[]>(initialStats);
  const [userStats, setUserStats] = useState<StatData[]>(initialUserStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const { toast } = useToast();

  const [redeemCode, setRedeemCode] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [maxUses, setMaxUses] = useState<number | string>(1);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [recentlyGeneratedCodes, setRecentlyGeneratedCodes] = useState<(RedeemCodeEntry & { codeString: string })[]>([]);


  useEffect(() => {
    const fetchOtherData = async () => {
      if (!database) return;
      setIsLoadingActivities(true);

      try {
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        let totalUsers = 0;
        let todayRegistrations = 0;

        if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            const userIds = Object.keys(usersData);
            totalUsers = userIds.length;
            
            userIds.forEach(id => {
                const user = usersData[id];
                if(user.createdAt && isToday(parseISO(user.createdAt))) {
                    todayRegistrations++;
                }
            });
        }
        
        const pendingWithdrawalsQuery = query(ref(database, 'withdrawRequests'), orderByChild('status'), equalTo('pending'));
        const pendingWithdrawalsSnapshot = await get(pendingWithdrawalsQuery);
        const pendingWithdrawalsCount = pendingWithdrawalsSnapshot.exists() ? Object.keys(pendingWithdrawalsSnapshot.val()).length : 0;
        
        setUserStats(prevStats => prevStats.map(stat => {
            if (stat.title === 'Total Users') return { ...stat, value: totalUsers.toLocaleString() };
            if (stat.title === "Today's Registrations") return { ...stat, value: todayRegistrations.toLocaleString() };
            if (stat.title === 'Pending Withdrawals') return { ...stat, value: pendingWithdrawalsCount.toLocaleString() };
            return stat;
        }));

        const transactionsSnapshot = await get(ref(database, 'walletTransactions'));
        let totalRevenue = 0;
        let totalPayouts = 0;

        if (transactionsSnapshot.exists()) {
            const allTransactionsByUser = transactionsSnapshot.val();
            for (const userId in allTransactionsByUser) {
                const userTxs = allTransactionsByUser[userId];
                for (const txId in userTxs) {
                    const tx = userTxs[txId] as WalletTransaction;
                    if (tx.status === 'completed') {
                       if (tx.type === 'entry_fee') totalRevenue += Math.abs(tx.amount);
                       if (tx.type === 'shop_purchase_complete') totalRevenue += Math.abs(tx.amount);
                       if (tx.type === 'withdrawal') totalPayouts += Math.abs(tx.amount);
                       if (tx.type === 'prize') totalPayouts += tx.amount;
                    }
                }
            }
        }
        
        const netProfit = totalRevenue - totalPayouts;
        setFinancialStats([
            { ...initialStats[0], value: `PKR ${totalRevenue.toLocaleString()}`},
            { ...initialStats[1], value: `PKR ${totalPayouts.toLocaleString()}`},
            { ...initialStats[2], value: `PKR ${netProfit.toLocaleString()}`},
        ]);
        
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

    if (!database) {
      toast({ title: "Database Error", description: "Firebase database not initialized.", variant: "destructive" });
      setIsLoadingStats(false);
      return;
    }

    const liveTournamentsQuery = query(ref(database, 'tournaments'), orderByChild('status'), equalTo('live'));
    const tournamentsListener = onValue(liveTournamentsQuery, (snapshot) => {
        const activeTournamentsCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        setUserStats(prevStats => prevStats.map(stat => 
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
        setUserStats(prevStats => prevStats.map(stat => 
            stat.title === 'Active Users' ? { ...stat, value: activeUsersCount.toLocaleString() } : stat
        ));
    }, (error) => {
        console.error("Error fetching active users:", error);
        toast({ title: "Live Data Error", description: "Could not get real-time active user count.", variant: "destructive" });
    });

    return () => {
        off(liveTournamentsQuery, 'value', tournamentsListener);
        off(activeUsersQuery, 'value', activeUsersListener);
    };

  }, [toast]);

  const handleGenerateRedeemCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = parseFloat(redeemAmount);
    const numericMaxUses = parseInt(String(maxUses), 10);

    if (!redeemCode.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid code and amount.", variant: "destructive" });
      return;
    }
    if (isNaN(numericMaxUses) || numericMaxUses <= 0) {
      toast({ title: "Invalid Input", description: "Max uses must be a positive number.", variant: "destructive" });
      return;
    }

    setIsGeneratingCode(true);
    try {
      if (!database) throw new Error("Firebase not initialized");
      
      const codeString = redeemCode.trim().toUpperCase();
      const existingCodeRef = ref(database, `redeemCodes/${codeString}`);
      const existingCodeSnap = await get(existingCodeRef);
      if (existingCodeSnap.exists()) {
        toast({ title: "Code Exists", description: `Code "${codeString}" already exists.`, variant: "destructive" });
        setIsGeneratingCode(false);
        return;
      }

      const newCodeEntry: RedeemCodeEntry = {
        amount: numericAmount, isUsed: false, usedBy: null,
        createdAt: new Date().toISOString(), maxUses: numericMaxUses,
        timesUsed: 0, claimedBy: {},
      };
      
      await set(ref(database, `redeemCodes/${codeString}`), newCodeEntry);
      
      const newCodeForDisplay = { ...newCodeEntry, codeString };
      setRecentlyGeneratedCodes(prev => [newCodeForDisplay, ...prev].slice(0, 5));

      toast({ title: "Code Generated", description: `Code "${codeString}" created.`, className: "bg-green-500/20" });
      setRedeemCode('');
      setRedeemAmount('');
      setMaxUses(1);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingCode(false);
    }
  };
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Code "${code}" copied to clipboard.` });
  };

  const renderTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return <span className="text-red-500">Invalid date</span>;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return <span className="text-red-500">Date error</span>;
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    setRecentActivities(currentActivities =>
      currentActivities.filter(activity => activity.id !== activityId)
    );
    toast({
      title: "Activity Hidden",
      description: "The activity has been hidden from this view.",
      variant: "default",
    });
  };

  const renderStatCard = (stat: StatData, index: number) => (
      <motion.div key={stat.title} variants={cardVariants} whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }} transition={{ type: 'spring', stiffness: 300 }}>
        <GlassCard className="p-0 overflow-hidden h-full">
            <Link href={stat.href || '#'} className={`block h-full ${stat.href ? 'hover:bg-muted/10 transition-colors' : 'cursor-default'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
                </CardHeader>
                <CardContent>
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground pt-1 truncate">{stat.description || 'View Details'}</p>
                </CardContent>
            </Link>
        </GlassCard>
      </motion.div>
  );

  const canGenerateRedeemCode = appUser?.role === 'admin' || (appUser?.role === 'delegate' && appUser.delegatePermissions?.accessScreens?.coupons);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground">A full overview of your application's performance.</p>
      </motion.div>
      
      {isLoadingStats ? (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <GlassCard key={index} className="p-0 overflow-hidden h-36 animate-pulse">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-5 w-5 bg-muted rounded-full"></div>
                    </CardHeader>
                    <CardContent><div className="h-8 bg-muted rounded w-1/2 mb-2"></div><div className="h-3 bg-muted rounded w-1/4"></div></CardContent>
                </GlassCard>
            ))}
          </div>
      ) : (
         <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Financial Overview</h2>
            <div className="md:hidden">
                <ScrollArea className="w-full whitespace-nowrap">
                    <motion.div className="flex w-max space-x-4 pb-4" variants={containerVariants} initial="hidden" animate="visible">
                        {financialStats.map(renderStatCard)}
                    </motion.div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            <motion.div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={containerVariants} initial="hidden" animate="visible">
                {financialStats.map(renderStatCard)}
            </motion.div>
         </div>
      )}

      <Separator />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-foreground">User & Engagement Metrics</h2>
            <div className="md:hidden">
                <ScrollArea className="w-full whitespace-nowrap">
                    <motion.div className="flex w-max space-x-4 pb-4" variants={containerVariants} initial="hidden" animate="visible">
                        {userStats.map(renderStatCard)}
                    </motion.div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            <motion.div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={containerVariants} initial="hidden" animate="visible">
                {userStats.map(renderStatCard)}
            </motion.div>
            
            {canGenerateRedeemCode && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <GlassCard>
                    <h3 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h3>
                    <form onSubmit={handleGenerateRedeemCode} className="space-y-4">
                        <Label>Generate Redeem Code</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div><Label htmlFor="redeemCode" className="text-xs text-muted-foreground">Code</Label><Input id="redeemCode" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder="E.g., WELCOME50" /></div>
                            <div><Label htmlFor="redeemAmount" className="text-xs text-muted-foreground">Amount (Rs)</Label><Input id="redeemAmount" type="number" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} placeholder="e.g., 100" /></div>
                            <div><Label htmlFor="maxUses" className="text-xs text-muted-foreground">Max Uses</Label><Input id="maxUses" type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="e.g., 1" /></div>
                        </div>
                        <Button type="submit" disabled={isGeneratingCode} className="w-full sm:w-auto">
                            {isGeneratingCode ? <Loader2 className="animate-spin mr-2" /> : <Ticket className="mr-2 h-4" />}
                            Generate Code
                        </Button>
                    </form>
                    {recentlyGeneratedCodes.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <h4 className="text-sm font-semibold text-muted-foreground">Recently Generated:</h4>
                             <ul className="space-y-2">
                                {recentlyGeneratedCodes.map(code => (
                                    <li key={code.codeString} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <p className="font-mono text-foreground text-sm">{code.codeString}</p>
                                            <p className="text-xs text-muted-foreground">(Rs {code.amount}, {code.maxUses} uses)</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(code.codeString)}><Copy className="h-4 w-4"/></Button>
                                    </li>
                                ))}
                             </ul>
                        </div>
                    )}
                </GlassCard>
            </motion.div>
            )}
        </div>

        <motion.div className="xl:col-span-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <GlassCard className="h-full">
                <h3 className="text-xl font-semibold mb-4 text-foreground">Recent Activity</h3>
                {isLoadingActivities ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-accent" />
                </div>
                ) : recentActivities.length > 0 ? (
                <ScrollArea className="h-[400px]">
                    <ul className="space-y-3 pr-2">
                    {recentActivities.map((activity, index) => (
                        <motion.li key={activity.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start space-x-3 p-3 bg-background/30 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors">
                            <activity.icon className="h-6 w-6 text-accent mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm text-foreground leading-snug">{activity.description}</p>
                                <p className="text-xs text-muted-foreground">
                                {renderTimestamp(activity.timestamp)}
                                </p>
                            </div>
                            <Button variant='ghost' size='sm' onClick={() => handleDeleteActivity(activity.id)} className="shrink-0 ml-auto p-1 h-auto opacity-50 hover:opacity-100">
                                <Trash className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                        </motion.li>
                    ))}
                    </ul>
                </ScrollArea>
                ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <Hourglass className="mx-auto h-12 w-12 mb-3 text-muted-foreground/50" />
                    No recent activity found.
                </div>
                )}
            </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

