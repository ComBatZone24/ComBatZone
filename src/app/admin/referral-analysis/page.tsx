
"use client";

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, GitBranch, AlertCircle, CalendarDays, Users, MessageSquare as WhatsappIcon } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User, WalletTransaction } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface DelegateStats {
  delegateName: string;
  delegateUid: string;
  totalReferred: number;
  weeklyReferred: number;
  monthlyReferred: number;
  totalTopUp: number;
  avatarUrl: string | null;
  whatsappNumber?: string;
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchAndAnalyzeData = async () => {
      setIsLoading(true);
      setError(null);
      if (!database) {
        setError("Database service is not available.");
        setIsLoading(false);
        return;
      }

      try {
        const usersSnapshot = await get(ref(database, 'users'));
        const transactionsSnapshot = await get(ref(database, 'walletTransactions'));

        if (!usersSnapshot.exists()) {
          throw new Error("No user data found.");
        }

        const allUsers: Record<string, User> = usersSnapshot.val();
        const allTransactions: Record<string, Record<string, WalletTransaction>> = transactionsSnapshot.val() || {};
        
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
                };
            }
        }
        
        const now = new Date();
        const startOfWeek = new Date(now);
        const dayOfWeek = now.getDay();
        const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        for (const user of allUserArray) {
            if (user.appliedReferralCode && typeof user.appliedReferralCode === 'string' && user.appliedReferralCode.trim() !== '') {
                const normalizedAppliedCode = user.appliedReferralCode.trim().toUpperCase();
                const delegateUid = delegateCodeToUidMap[normalizedAppliedCode];

                if (delegateUid && delegateStats[delegateUid]) {
                    delegateStats[delegateUid].totalReferred++;

                    if (user.createdAt) {
                        try {
                           const registrationDate = new Date(user.createdAt);
                           if (!isNaN(registrationDate.getTime())) {
                               if (registrationDate >= startOfWeek) {
                                   delegateStats[delegateUid].weeklyReferred++;
                               }
                               if (registrationDate >= startOfMonth) {
                                   delegateStats[delegateUid].monthlyReferred++;
                               }
                           }
                        } catch (e) {
                            console.warn(`Could not parse createdAt date for user ${user.id}: ${user.createdAt}`);
                        }
                    }
                    
                    const userTransactions = allTransactions[user.id];
                    if (userTransactions) {
                        let userTopUpTotal = 0;
                        for (const txId in userTransactions) {
                            const tx = userTransactions[txId];
                            if (tx && tx.type === 'topup' && tx.status === 'completed' && typeof tx.amount === 'number') {
                                userTopUpTotal += tx.amount;
                            }
                        }
                        delegateStats[delegateUid].totalTopUp += userTopUpTotal;
                    }
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
    };

    fetchAndAnalyzeData();
  }, [toast]);
  
  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle 
        title="Referral & Delegate Analysis"
        subtitle="Track delegate performance, including weekly and monthly referrals."
      />
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
             <p className="text-xs mt-1">Users need to sign up using referral codes for data to appear here.</p>
          </div>
        ) : (
          <div className="flex-1">
            {/* Desktop Table View */}
            <div className="hidden md:block relative h-full">
              <ScrollArea className="absolute inset-0">
                <Table className="min-w-[950px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Delegate</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-center">Total Referrals</TableHead>
                      <TableHead className="text-center">Weekly</TableHead>
                      <TableHead className="text-center">Monthly</TableHead>
                      <TableHead className="text-right">Total Top-Up by Referred Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisData.map((delegate) => (
                      <TableRow key={delegate.delegateUid}>
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
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {analysisData.map((delegate) => (
                    <GlassCard key={delegate.delegateUid} className="p-4 bg-card/80">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12 border-2 border-primary/30">
                          <AvatarImage src={delegate.avatarUrl || undefined} alt={delegate.delegateName}/>
                          <AvatarFallback>{delegate.delegateName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg text-foreground">{delegate.delegateName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{delegate.delegateUid}</p>
                        </div>
                      </div>
                      <Separator className="mb-3 bg-border/50" />
                      <div className="space-y-2">
                        <StatItem icon={WhatsappIcon} label="WhatsApp" value={delegate.whatsappNumber || 'N/A'}/>
                        <StatItem icon={Users} label="Total Referrals" value={delegate.totalReferred} />
                        <StatItem icon={CalendarDays} label="Weekly Referrals" value={delegate.weeklyReferred} />
                        <StatItem icon={CalendarDays} label="Monthly Referrals" value={delegate.monthlyReferred} />
                        <div className="flex justify-between items-center text-sm py-1.5">
                          <span className="flex items-center text-muted-foreground"><RupeeIcon className="mr-2 h-4 w-4"/>Total Top-up</span>
                          <span className="font-semibold text-foreground">
                            {delegate.totalTopUp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </GlassCard>
      
      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">How this works</AlertTitle>
        <AlertDescription className="!text-primary/80">
          This page analyzes all users to find delegates (users with a `referralCode` and role `delegate`). It then counts how many other users have registered using that delegate's code (via the `appliedReferralCode` field). It also sums up all 'topup' transactions made by those referred users to calculate the total contribution. Weekly refers to the current week (Monday-Sunday).
        </AlertDescription>
      </Alert>
    </div>
  );
}
