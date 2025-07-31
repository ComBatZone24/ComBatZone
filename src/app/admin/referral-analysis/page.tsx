
"use client";

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, GitBranch, AlertCircle, CalendarDays, Users, MessageSquare as WhatsappIcon, ChevronDown, ChevronRight, Wallet, Upload, Download as DownloadIcon, Search } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User, WalletTransaction, Tournament } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


interface ReferredUserDetails {
    id: string;
    username: string;
    avatarUrl: string | null;
    wallet: number;
    topUpCount: number;
    withdrawalCount: number;
    matchesJoined: number;
}

interface DelegateStats {
  delegateUid: string;
  delegateName: string;
  avatarUrl: string | null;
  whatsappNumber?: string;
  totalReferred: number;
  weeklyReferred: number;
  monthlyReferred: number;
  totalTopUp: number;
  referredUsers: ReferredUserDetails[];
}

const StatItem: React.FC<{ icon: React.ElementType, label: string, value: string | number }> = ({ icon: Icon, label, value }) => (
    <div className="flex justify-between items-center text-sm py-1.5">
      <span className="flex items-center text-muted-foreground"><Icon className="mr-2 h-4 w-4"/>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
);


export default function ReferralAnalysisPage() {
  const [analysisData, setAnalysisData] = useState<DelegateStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const [searchUid, setSearchUid] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const toggleOpen = (delegateUid: string) => {
    setOpenStates(prev => ({...prev, [delegateUid]: !prev[delegateUid]}));
  };

  const handleSearch = async () => {
    if (!searchUid.trim()) {
        toast({ title: "Input Required", description: "Please enter a User ID to search." });
        return;
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
        const userRef = ref(database, `users/${searchUid.trim()}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            setSearchResult({ message: "No user found with this ID.", type: 'error' });
            setIsSearching(false);
            return;
        }

        const userData = userSnapshot.val() as User;
        const appliedCode = userData.appliedReferralCode;

        if (!appliedCode) {
            setSearchResult({ message: `User '${userData.username}' has not applied any referral code.`, type: 'info' });
            setIsSearching(false);
            return;
        }

        const referrerQuery = query(ref(database, 'users'), orderByChild('referralCode'), equalTo(appliedCode));
        const referrerSnapshot = await get(referrerQuery);

        if (referrerSnapshot.exists()) {
            const referrerData = referrerSnapshot.val();
            const referrerId = Object.keys(referrerData)[0];
            const referrer = referrerData[referrerId] as User;
            setSearchResult({ message: `User '${userData.username}' was referred by '${referrer.username}'.`, type: 'success' });
        } else {
            setSearchResult({ message: `User '${userData.username}' applied code '${appliedCode}', but the referrer could not be found.`, type: 'error' });
        }

    } catch (err: any) {
        toast({ title: "Search Error", description: err.message, variant: "destructive" });
    } finally {
        setIsSearching(false);
    }
  };

  const fetchAndAnalyzeData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!database) {
      setError("Database service is not available.");
      setIsLoading(false);
      return;
    }

    try {
      const usersSnapshotPromise = get(ref(database, 'users'));
      const transactionsSnapshotPromise = get(ref(database, 'walletTransactions'));
      const tournamentsSnapshotPromise = get(ref(database, 'tournaments'));

      const [usersSnapshot, transactionsSnapshot, tournamentsSnapshot] = await Promise.all([
          usersSnapshotPromise,
          transactionsSnapshotPromise,
          tournamentsSnapshotPromise,
      ]);

      if (!usersSnapshot.exists()) {
        throw new Error("No user data found.");
      }

      const allUsers: Record<string, User> = usersSnapshot.val();
      const allTransactions: Record<string, Record<string, WalletTransaction>> = transactionsSnapshot.val() || {};
      const allTournaments: Record<string, Tournament> = tournamentsSnapshot.val() || {};

      const delegateCodeToUidMap: { [code: string]: string } = {};
      const allUserArray: (User & { id: string })[] = Object.entries(allUsers).map(([id, user]) => ({ id, ...user }));

      for (const user of allUserArray) {
        if (user.referralCode && typeof user.referralCode === 'string' && user.referralCode.trim() !== '' && user.role === 'delegate') {
          const normalizedCode = user.referralCode.trim().toUpperCase();
          delegateCodeToUidMap[normalizedCode] = user.id;
        }
      }

      const delegateStats: { [uid: string]: DelegateStats } = {};
      for (const delegateUid of Object.values(delegateCodeToUidMap)) {
        const delegateInfo = allUsers[delegateUid];
        if (delegateInfo) {
          delegateStats[delegateUid] = {
            delegateUid,
            delegateName: delegateInfo.username || 'Unnamed Delegate',
            avatarUrl: delegateInfo.avatarUrl || null,
            whatsappNumber: delegateInfo.whatsappNumber,
            totalReferred: 0,
            weeklyReferred: 0,
            monthlyReferred: 0,
            totalTopUp: 0,
            referredUsers: [],
          };
        }
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      for (const user of allUserArray) {
        if (user.appliedReferralCode && typeof user.appliedReferralCode === 'string' && user.appliedReferralCode.trim() !== '') {
          const normalizedAppliedCode = user.appliedReferralCode.trim().toUpperCase();
          const delegateUid = delegateCodeToUidMap[normalizedAppliedCode];

          if (delegateUid && delegateStats[delegateUid]) {
            const stats = delegateStats[delegateUid];
            stats.totalReferred++;

            if (user.createdAt) {
              try {
                const registrationDate = new Date(user.createdAt);
                if (!isNaN(registrationDate.getTime())) {
                  if (registrationDate >= startOfWeek) stats.weeklyReferred++;
                  if (registrationDate >= startOfMonth) stats.monthlyReferred++;
                }
              } catch (e) {
                console.warn(`Could not parse createdAt date for user ${user.id}: ${user.createdAt}`);
              }
            }

            const userTransactions = allTransactions[user.id] || {};
            let userTopUpTotal = 0;
            let topUpCount = 0;
            let withdrawalCount = 0;
            for (const txId in userTransactions) {
              const tx = userTransactions[txId];
              if (tx && tx.status === 'completed') {
                if (tx.type === 'topup' && typeof tx.amount === 'number') {
                  userTopUpTotal += tx.amount;
                  topUpCount++;
                } else if (tx.type === 'withdrawal') {
                  withdrawalCount++;
                }
              }
            }
            stats.totalTopUp += userTopUpTotal;
            
            let matchesJoined = 0;
            for(const tId in allTournaments) {
                const tournament = allTournaments[tId];
                if(tournament.playersJoined && tournament.playersJoined[user.id]){
                    matchesJoined++;
                }
            }
            
            stats.referredUsers.push({
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl || null,
                wallet: user.wallet || 0,
                topUpCount,
                withdrawalCount,
                matchesJoined,
            });
          }
        }
      }

      const finalAnalysisData = Object.values(delegateStats)
        .filter(d => d.totalReferred > 0)
        .sort((a, b) => b.totalReferred - a.totalReferred);

      setAnalysisData(finalAnalysisData);

    } catch (err: any) {
      console.error("Error analyzing referral data:", err);
      let errorMessage = err.message || "An unknown error occurred.";
      if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('permission_denied')) {
        errorMessage = 'Permission denied. Please check your Firebase security rules for reading /users and /walletTransactions.';
      }
      setError(errorMessage);
      toast({ title: "Analysis Failed", description: "Could not process referral data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndAnalyzeData();
  }, [fetchAndAnalyzeData]);
  
  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle 
        title="Referral & Delegate Analysis"
        subtitle="Track delegate performance, including weekly and monthly referrals."
      />
      
      <GlassCard>
        <h3 className="text-lg font-semibold text-foreground mb-2">Find Referrer by User ID</h3>
        <div className="flex gap-2">
            <Input 
                value={searchUid}
                onChange={(e) => setSearchUid(e.target.value)}
                placeholder="Enter User ID..."
                className="bg-input/50"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
        </div>
        {searchResult && (
            <Alert className={`mt-4 text-sm ${searchResult.type === 'success' ? 'border-green-500/50 text-green-300' : 'border-red-500/50 text-red-300'}`}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{searchResult.type === 'success' ? 'Referrer Found' : 'Result'}</AlertTitle>
                <AlertDescription>{searchResult.message}</AlertDescription>
            </Alert>
        )}
      </GlassCard>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <GitBranch className="mr-2 h-5 w-5 text-accent" /> Delegate Performance
          </h3>
        </div>
        
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-3 text-muted-foreground">Analyzing data...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">{error}</div>
        ) : analysisData.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
             <p>No referral data found to analyze.</p>
             <p className="text-xs mt-1">Delegates need to refer users for data to appear here.</p>
          </div>
        ) : (
          <div className="flex-1">
            <ScrollArea className="h-full">
                <Table className="min-w-[950px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Delegate</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-center">Total Referrals</TableHead>
                      <TableHead className="text-center">Weekly</TableHead>
                      <TableHead className="text-center">Monthly</TableHead>
                      <TableHead className="text-right">Total Top-Up by Referred Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  
                  {analysisData.map((delegate) => (
                      <Collapsible asChild key={delegate.delegateUid} open={openStates[delegate.delegateUid] || false} onOpenChange={() => toggleOpen(delegate.delegateUid)}>
                        <TableBody>
                          <TableRow className="border-b-0 hover:bg-muted/20">
                            <TableCell>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                       {openStates[delegate.delegateUid] ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                                    </Button>
                                </CollapsibleTrigger>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-primary/30">
                                  <AvatarImage src={delegate.avatarUrl || undefined} alt={delegate.delegateName}/>
                                  <AvatarFallback>{delegate.delegateName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-foreground">{delegate.delegateName}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{delegate.delegateUid}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{delegate.whatsappNumber || 'N/A'}</TableCell>
                            <TableCell className="text-center font-bold text-lg text-accent">{delegate.totalReferred}</TableCell>
                            <TableCell className="text-center font-medium text-foreground">{delegate.weeklyReferred}</TableCell>
                            <TableCell className="text-center font-medium text-foreground">{delegate.monthlyReferred}</TableCell>
                            <TableCell className="text-right font-semibold">
                              <RupeeIcon className="inline h-3.5 mr-0.5 -mt-0.5" />
                              {delegate.totalTopUp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                             <TableRow className="bg-muted/10">
                                <TableCell colSpan={7} className="p-0">
                                    <div className="p-4">
                                        <h4 className="text-sm font-semibold mb-2 ml-2">Referred Users ({delegate.referredUsers.length})</h4>
                                        <div className="max-h-60 overflow-y-auto pr-2">
                                            <Table>
                                                 <TableHeader>
                                                    <TableRow className="border-b-border/30">
                                                        <TableHead>User</TableHead>
                                                        <TableHead className="text-center">Wallet</TableHead>
                                                        <TableHead className="text-center">Top-ups</TableHead>
                                                        <TableHead className="text-center">Withdrawals</TableHead>
                                                        <TableHead className="text-center">Matches</TableHead>
                                                    </TableRow>
                                                 </TableHeader>
                                                 <TableBody>
                                                     {delegate.referredUsers.map(user => (
                                                        <TableRow key={user.id} className="border-b-border/20">
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-8 w-8 border-2 border-border/50"><AvatarImage src={user.avatarUrl || undefined}/><AvatarFallback>{user.username.charAt(0)}</AvatarFallback></Avatar>
                                                                    <div>
                                                                        <p className="font-medium text-sm">{user.username}</p>
                                                                        <p className="font-mono text-xs text-muted-foreground">{user.id}</p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                             <TableCell className="text-center font-mono"><RupeeIcon className="inline h-3"/> {user.wallet.toFixed(2)}</TableCell>
                                                             <TableCell className="text-center text-green-400">{user.topUpCount}</TableCell>
                                                             <TableCell className="text-center text-red-400">{user.withdrawalCount}</TableCell>
                                                             <TableCell className="text-center">{user.matchesJoined}</TableCell>
                                                        </TableRow>
                                                     ))}
                                                 </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </TableCell>
                             </TableRow>
                          </CollapsibleContent>
                        </TableBody>
                      </Collapsible>
                  ))}
                </Table>
            </ScrollArea>
          </div>
        )}
      </GlassCard>
      
      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">How this works</AlertTitle>
        <AlertDescription className="!text-primary/80">
          This page analyzes all users to find delegates and then counts how many other users have registered using that delegate's code. It also sums up all 'topup' transactions made by those referred users to calculate the total contribution. Weekly refers to the current week (Monday-Sunday).
        </AlertDescription>
      </Alert>
    </div>
  );
}

