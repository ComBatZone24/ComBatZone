
"use client";

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User, RedeemCodeEntry } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Loader2, Ticket, Users, MessageSquare as WhatsappIcon, ChevronDown, ChevronRight, Wallet, CheckCircle } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';

interface DelegateCodeStats {
  delegateUid: string;
  delegateName: string;
  avatarUrl: string | null;
  whatsappNumber?: string;
  totalCreated: number;
  weeklyCreated: number;
  monthlyCreated: number;
  totalAmountRedeemed: number;
  createdCodes: (RedeemCodeEntry & { codeString: string })[];
}

export default function RedeemCodeAnalysisPage() {
  const [analysisData, setAnalysisData] = useState<DelegateCodeStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const toggleOpen = (delegateUid: string) => {
    setOpenStates(prev => ({...prev, [delegateUid]: !prev[delegateUid]}));
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
      const [usersSnapshot, codesSnapshot] = await Promise.all([
        get(ref(database, 'users')),
        get(ref(database, 'redeemCodes'))
      ]);
      
      if (!usersSnapshot.exists()) {
        throw new Error("No user data found to perform analysis.");
      }

      const allUsers: Record<string, User> = usersSnapshot.val();
      const allCodes: Record<string, RedeemCodeEntry> = codesSnapshot.exists() ? codesSnapshot.val() : {};
      
      const delegateStats: { [uid: string]: DelegateCodeStats } = {};

      for (const uid in allUsers) {
        const user = allUsers[uid];
        if (user.role === 'admin' || user.role === 'delegate') {
          delegateStats[uid] = {
            delegateUid: uid,
            delegateName: user.username || 'Unnamed User',
            avatarUrl: user.avatarUrl || null,
            whatsappNumber: user.whatsappNumber,
            totalCreated: 0,
            weeklyCreated: 0,
            monthlyCreated: 0,
            totalAmountRedeemed: 0,
            createdCodes: [],
          };
        }
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      for (const codeString in allCodes) {
        const code = allCodes[codeString];
        const creatorId = code.createdBy;
        if (creatorId && delegateStats[creatorId]) {
          const stats = delegateStats[creatorId];
          stats.totalCreated++;
          stats.createdCodes.push({ ...code, codeString });

          if (code.createdAt) {
              try {
                const creationDate = new Date(code.createdAt);
                if (!isNaN(creationDate.getTime())) {
                  if (creationDate >= startOfWeek) stats.weeklyCreated++;
                  if (creationDate >= startOfMonth) stats.monthlyCreated++;
                }
              } catch (e) { console.warn(`Could not parse date for code ${codeString}:`, code.createdAt); }
          }
          
          if (code.claimedBy) {
            stats.totalAmountRedeemed += Object.keys(code.claimedBy).length * code.amount;
          }
        }
      }

      const finalAnalysisData = Object.values(delegateStats)
        .filter(d => d.totalCreated > 0)
        .sort((a, b) => b.totalCreated - a.totalCreated);

      setAnalysisData(finalAnalysisData);
    } catch (err: any) {
      console.error("Error analyzing redeem code data:", err);
      setError(err.message || "An unknown error occurred.");
      toast({ title: "Analysis Failed", description: "Could not process redeem code data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchAndAnalyzeData();
  }, [fetchAndAnalyzeData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground text-lg">Analyzing redeem code data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Redeem Code Analysis" subtitle="Track redeem code creation by delegates and admins." />

      {error ? (
        <div className="p-6 text-center text-destructive">{error}</div>
      ) : analysisData.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Ticket className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-xl text-muted-foreground">No codes created by delegates or admins found.</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {analysisData.map((delegate) => (
            <Collapsible key={delegate.delegateUid} open={openStates[delegate.delegateUid] || false} onOpenChange={() => toggleOpen(delegate.delegateUid)}>
              <GlassCard className="p-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-4 cursor-pointer">
                    <Avatar className="h-12 w-12 border-2 border-accent/50">
                      <AvatarImage src={delegate.avatarUrl || undefined} alt={delegate.delegateName} />
                      <AvatarFallback>{delegate.delegateName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="font-bold text-foreground text-lg">{delegate.delegateName}</p>
                        <p className="text-xs text-muted-foreground">{delegate.whatsappNumber || 'No Contact'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-accent text-lg">{delegate.totalCreated}</p>
                        <p className="text-xs text-muted-foreground">Total Codes</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-lg">{delegate.weeklyCreated} / {delegate.monthlyCreated}</p>
                        <p className="text-xs text-muted-foreground">Weekly / Monthly</p>
                      </div>
                      <div>
                        <p className="font-semibold text-green-400 text-lg flex items-center justify-center gap-1"><RupeeIcon className="h-4" />{delegate.totalAmountRedeemed.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Value Redeemed</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {openStates[delegate.delegateUid] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <h4 className="font-semibold text-md mb-2">Created Codes ({delegate.createdCodes.length})</h4>
                    <ScrollArea className="h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead>Redeemed By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {delegate.createdCodes.map(code => (
                            <TableRow key={code.codeString}>
                              <TableCell className="font-mono">{code.codeString}</TableCell>
                              <TableCell><RupeeIcon className="inline h-3.5"/> {code.amount.toFixed(2)}</TableCell>
                              <TableCell>{code.timesUsed || 0} / {code.maxUses}</TableCell>
                              <TableCell>
                                {code.claimedBy ? Object.keys(code.claimedBy).length : 0} users
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </GlassCard>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
