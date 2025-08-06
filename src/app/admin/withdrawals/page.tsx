
"use client";

import { useState, useEffect, useCallback } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Hourglass, RefreshCcw, AlertCircle, Trash2, UserCircle, ShieldCheck, Mail, Loader2 } from 'lucide-react';
import type { WithdrawRequest, User as AppUserType } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

import { database } from '@/lib/firebase/config';
import { ref, onValue, off, remove } from 'firebase/database';
import PageTitle from '@/components/core/page-title';

export default function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<AppUserType | null>(null);
  const [isRecipientLoading, setIsRecipientLoading] = useState(false);

  const fetchFeeRecipient = useCallback(async (request: WithdrawRequest): Promise<void> => {
    setIsRecipientLoading(true);
    setIsRecipientDialogOpen(true);
    try {
        const response = await fetch('/api/process-withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_recipient', requestId: request.id })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message);
        }
        setSelectedRecipient(result.recipient);
    } catch (error: any) {
        toast({ title: "Recipient Fetch Error", description: error.message, variant: "destructive" });
        setSelectedRecipient(null);
    } finally {
        setIsRecipientLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const withdrawalsRef = ref(database, 'withdrawRequests');
    const listener = onValue(withdrawalsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedWithdrawals: WithdrawRequest[] = Object.keys(data).map(id => ({
          id,
          ...data[id],
        })).sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
        setWithdrawals(loadedWithdrawals);
      } else {
        setWithdrawals([]);
      }
      setIsLoading(false);
    }, (errorObject: Error) => { 
      console.error("Error fetching withdrawals:", errorObject);
      toast({ title: "Fetch Error", description: "Could not load withdrawal requests.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      if (database) { 
        off(withdrawalsRef, 'value', listener);
      }
    };
  }, [toast]);

  const handleUpdateStatus = async (requestId: string, newAdminDecision: 'approved' | 'rejected') => {
    setIsUpdating(prev => ({ ...prev, [requestId]: true }));
    
    try {
      const response = await fetch('/api/process-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          action: newAdminDecision
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'An unknown error occurred.');
      }
      
      toast({
        title: result.title,
        description: result.message,
        variant: "default",
        className: newAdminDecision === 'approved' 
          ? "bg-green-500/20 text-green-300 border-green-500/30" 
          : "bg-blue-500/20 text-blue-300 border-blue-500/30",
      });

    } catch (error: any) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };
  
  const handleDeleteRequest = async (requestId: string) => {
    if (!database) return;
    if (!confirm("Are you sure you want to delete this withdrawal request? This action cannot be undone.")) return;
    setIsDeleting(prev => ({ ...prev, [requestId]: true }));
    try {
      await remove(ref(database, `withdrawRequests/${requestId}`));
      toast({ title: "Request Deleted", description: "Withdrawal request has been successfully deleted.", variant: "default" });
    } catch (error: any) {
      toast({ title: "Deletion Error", description: error.message || "Failed to delete request.", variant: "destructive" });
    } finally {
      setIsDeleting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><RefreshCcw className="h-10 w-10 animate-spin text-accent" /></div>;
  }

  return (
    <>
      <div className="flex h-full flex-col space-y-6">
        <PageTitle title="Manage Withdrawal Requests" subtitle="Review and process user withdrawal requests." />
        
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Important Process Note</AlertTitle>
          <AlertDescription className="!text-primary/80">
            Approving a request finalizes payment. If the user was referred by a delegate, 5% of the withdrawal amount is sent to the delegate. If not referred, 5% is sent to the admin's fee wallet. Rejecting a request refunds the held amount to the user's wallet.
          </AlertDescription>
        </Alert>

        <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
          <div className="p-4 border-b border-border/30"><h3 className="text-lg font-semibold">Pending & Recent Requests</h3></div>
          <div className="relative flex-1">
            <ScrollArea className="absolute inset-0">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10"><TableHead>User</TableHead><TableHead>Method</TableHead><TableHead>Account No.</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Fee (5%)</TableHead><TableHead className="text-right">Net Payout</TableHead><TableHead className="text-center">Requested</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {withdrawals.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No withdrawal requests found.</TableCell></TableRow>}
                  {withdrawals.map((req) => (
                    <TableRow key={req.id} className="border-b-border/20 hover:bg-muted/20">
                      <TableCell><div><p>{req.username || 'N/A'}</p><p className="text-xs font-mono text-muted-foreground" title={req.uid}>{req.uid.substring(0,10)}...</p></div></TableCell>
                      <TableCell>{req.method}</TableCell>
                      <TableCell>{req.accountNumber}</TableCell>
                      <TableCell className="text-right font-semibold"><RupeeIcon className="inline h-3.5 w-auto mr-0.5" /> {req.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-400 font-mono">
                        <Button variant="link" className="p-0 h-auto text-red-400 hover:text-red-300 font-mono" onClick={() => fetchFeeRecipient(req)}>
                          <RupeeIcon className="inline h-3 w-auto mr-0.5" /> {(req.amount * 0.05).toFixed(2)}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-400"><RupeeIcon className="inline h-3.5 w-auto mr-0.5" /> {(req.amount * 0.95).toFixed(2)}</TableCell>
                      <TableCell className="text-center text-xs">{new Date(req.requestDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center"><Badge variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'} className={req.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-500/30' : req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>{req.status}</Badge></TableCell>
                      <TableCell className="text-center">
                        {req.status === 'pending' ? (
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400 hover:text-green-300" onClick={() => handleUpdateStatus(req.id, 'approved')} disabled={isUpdating[req.id]} title="Approve & Finalize">{isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => handleUpdateStatus(req.id, 'rejected')} disabled={isUpdating[req.id]} title="Reject & Refund">{isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <XCircle className="h-4 w-4" />}</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400" onClick={() => handleDeleteRequest(req.id)} disabled={isDeleting[req.id]} title="Delete Request">{isDeleting[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </GlassCard>
      </div>

      <Dialog open={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen}>
          <DialogContent className="glass-card sm:max-w-sm">
             <DialogHeader>
                <DialogTitle className="text-accent">Fee Recipient Details</DialogTitle>
                <DialogDescription>This is who will receive the 5% fee for this withdrawal.</DialogDescription>
             </DialogHeader>
             <div className="py-4">
                {isRecipientLoading ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin h-8 w-8 text-accent"/></div>
                ) : selectedRecipient ? (
                     <GlassCard className="p-4 bg-background/50 flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-accent">
                            <AvatarImage src={selectedRecipient.avatarUrl || undefined} alt={selectedRecipient.username} />
                            <AvatarFallback>{selectedRecipient.username.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg text-foreground">{selectedRecipient.username}</p>
                            <Badge variant={selectedRecipient.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize mt-1">{selectedRecipient.role}</Badge>
                            <p className="text-xs text-muted-foreground font-mono mt-1" title={selectedRecipient.id}>ID: {selectedRecipient.id.substring(0, 12)}...</p>
                        </div>
                     </GlassCard>
                ) : (
                    <GlassCard className="p-4 bg-background/50">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                                <ShieldCheck className="h-8 w-8 text-muted-foreground"/>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-foreground">Admin Fee Wallet</p>
                                <p className="text-sm text-muted-foreground">Fee will be sent to the main admin account.</p>
                            </div>
                        </div>
                    </GlassCard>
                )}
             </div>
          </DialogContent>
      </Dialog>
    </>
  );
}
