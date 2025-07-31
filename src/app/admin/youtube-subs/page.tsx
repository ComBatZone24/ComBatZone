
"use client";

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, update, runTransaction, push } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUserType, GlobalSettings, WalletTransaction } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Submission {
  submissionId: string;
  userId: string;
  username: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
  aiRecommendation: 'approve' | 'reject';
  aiReason: string;
  processedBy?: string; // Admin UID
  processedAt?: number;
}

export default function YoutubeSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [settings, setSettings] = useState<GlobalSettings['youtubePromotionSettings'] | null>(null);

  useEffect(() => {
    if (!database) {
        setIsLoading(false);
        return;
    }

    const settingsRef = ref(database, 'globalSettings/youtubePromotionSettings');
    const onSettingsValue = onValue(settingsRef, (snapshot) => {
        setSettings(snapshot.val() ?? null);
    });

    const submissionsRef = ref(database, 'youtubeSubmissions');
    const onSubmissionsValue = onValue(submissionsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedSubmissions: Submission[] = [];
      if (data) {
        Object.keys(data).forEach(key => {
          loadedSubmissions.push({ submissionId: key, ...data[key] });
        });
      }
      setSubmissions(loadedSubmissions.sort((a, b) => b.submittedAt - a.submittedAt));
      setIsLoading(false);
    });

    return () => {
        off(settingsRef, 'value', onSettingsValue);
        off(submissionsRef, 'value', onSubmissionsValue);
    };
  }, []);

  const handleProcessSubmission = useCallback(async (submission: Submission, newStatus: 'approved' | 'rejected') => {
    if (!settings || !database) {
      toast({ title: "Error", description: "Settings not loaded or database unavailable.", variant: "destructive"});
      return;
    }
    
    setIsProcessing(prev => ({ ...prev, [submission.submissionId]: true }));

    try {
        const updates: Record<string, any> = {};
        updates[`/youtubeSubmissions/${submission.submissionId}/status`] = newStatus;
        updates[`/youtubeSubmissions/${submission.submissionId}/processedAt`] = serverTimestamp();
        
        if (newStatus === 'approved') {
            const pointsToAward = settings.pointsForSubscription || 0;
            if (pointsToAward > 0) {
                const userRef = ref(database, `users/${submission.userId}`);
                
                await runTransaction(userRef, (currentUserData: AppUserType | null) => {
                    if (currentUserData) {
                        if (currentUserData.youtubeSubscriptionAwarded) {
                            // Abort transaction but update submission status to rejected
                            updates[`/youtubeSubmissions/${submission.submissionId}/status`] = 'rejected';
                            updates[`/youtubeSubmissions/${submission.submissionId}/reason`] = 'User already awarded for this task.';
                            console.warn(`User ${submission.userId} already has subscription award. Aborting transaction.`);
                            return currentUserData; // return current data to abort and avoid changes
                        }
                        currentUserData.watchAndEarnPoints = (currentUserData.watchAndEarnPoints || 0) + pointsToAward;
                        currentUserData.youtubeSubscriptionAwarded = true;
                    }
                    return currentUserData;
                });
                
                // Check if the transaction was aborted due to already awarded status
                const finalStatus = updates[`/youtubeSubmissions/${submission.submissionId}/status`];
                if (finalStatus === 'rejected') {
                    toast({ title: "Action Stopped", description: "This user has already been awarded points for this task.", variant: "destructive" });
                } else {
                    toast({ title: "Approved!", description: `${submission.username} has been awarded ${pointsToAward} points.`, className: "bg-green-500/20" });
                }
            }
        } else { // Rejected
            toast({ title: "Rejected", description: `Submission for ${submission.username} has been rejected.`, variant: "default"});
        }
        
        await update(ref(database), updates);

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive"});
    } finally {
        setIsProcessing(prev => ({ ...prev, [submission.submissionId]: false }));
    }
  }, [settings, toast]);


  const getStatusBadge = (status: Submission['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'approved': return <Badge variant="default" className="bg-green-500/20 text-green-300">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAiBadge = (recommendation: Submission['aiRecommendation']) => {
    return recommendation === 'approve' 
      ? <Badge variant="default" className="bg-green-500/20 text-green-300">Approve</Badge> 
      : <Badge variant="destructive">Reject</Badge>;
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent"/></div>;
  }
  
  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const processedSubmissions = submissions.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-8">
      <PageTitle title="YouTube Subscription Verification" subtitle="Review user submissions for the YouTube subscription task."/>

      <GlassCard className="p-0">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold">Pending Submissions ({pendingSubmissions.length})</h3>
        </div>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>AI Suggestion</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingSubmissions.length > 0 ? pendingSubmissions.map(sub => (
                <TableRow key={sub.submissionId}>
                  <TableCell>
                      <p className="font-semibold">{sub.username}</p>
                      <p className="text-xs text-muted-foreground">{sub.userId.substring(0, 10)}...</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true })}</TableCell>
                  <TableCell>
                      {getAiBadge(sub.aiRecommendation)}
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{sub.aiReason}</p>
                  </TableCell>
                  <TableCell className="text-center space-x-2">
                    <Dialog>
                        <DialogTrigger asChild><Button variant="outline" size="sm">View</Button></DialogTrigger>
                        <DialogContent className="glass-card"><DialogHeader><DialogTitle>Screenshot from {sub.username}</DialogTitle></DialogHeader><Image src={sub.screenshotUrl} alt={`Submission from ${sub.username}`} width={1280} height={720} className="w-full h-auto rounded-md mt-4"/></DialogContent>
                    </Dialog>
                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleProcessSubmission(sub, 'approved')} disabled={isProcessing[sub.submissionId]}>
                        {isProcessing[sub.submissionId] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                    </Button>
                     <Button variant="destructive" size="sm" onClick={() => handleProcessSubmission(sub, 'rejected')} disabled={isProcessing[sub.submissionId]}>
                        {isProcessing[sub.submissionId] ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4"/>}
                    </Button>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No pending submissions.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ScrollArea>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold">Processed Submissions ({processedSubmissions.length})</h3>
        </div>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
             <TableBody>
              {processedSubmissions.length > 0 ? processedSubmissions.map(sub => (
                <TableRow key={sub.submissionId}>
                  <TableCell>
                      <p className="font-semibold">{sub.username}</p>
                      <p className="text-xs text-muted-foreground">{sub.userId.substring(0, 10)}...</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true })}</TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No processed submissions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ScrollArea>
      </GlassCard>

    </div>
  )
}
