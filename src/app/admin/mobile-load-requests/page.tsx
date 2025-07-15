
"use client";

import { useState, useEffect } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Hourglass, Trash2, Smartphone } from 'lucide-react';
import type { MobileLoadRequest, WalletTransaction } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { database } from '@/lib/firebase/config';
import { ref, onValue, off, update, runTransaction, push, remove } from 'firebase/database';
import PageTitle from '@/components/core/page-title';

export default function AdminMobileLoadRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<MobileLoadRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const requestsRef = ref(database, 'mobileLoadRequests');
    const listener = onValue(requestsRef, (snapshot) => {
      const loadedRequests: MobileLoadRequest[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(id => {
          loadedRequests.push({ id, ...data[id] });
        });
      }
      setRequests(loadedRequests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching mobile load requests:", error);
      toast({ title: "Fetch Error", description: "Could not load requests.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => off(requestsRef, 'value', listener);
  }, [toast]);

  const handleUpdateStatus = async (requestId: string, newStatus: 'completed' | 'rejected') => {
    setIsUpdating(prev => ({ ...prev, [requestId]: true }));
    const request = requests.find(r => r.id === requestId);

    if (!request) {
      toast({ title: "Error", description: "Request not found.", variant: "destructive" });
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
      return;
    }
    
    const { uid: userId, amount, walletTransactionId } = request;

    try {
      if (!database) throw new Error("Database not initialized");
      const updates: Record<string, any> = {};
      updates[`mobileLoadRequests/${requestId}/status`] = newStatus;
      updates[`mobileLoadRequests/${requestId}/processedDate`] = new Date().toISOString();

      if (newStatus === 'completed') {
        if (walletTransactionId) {
          updates[`walletTransactions/${userId}/${walletTransactionId}/status`] = 'completed';
          updates[`walletTransactions/${userId}/${walletTransactionId}/description`] = `Mobile Load to ${request.phoneNumber} completed.`;
        }
        toast({ title: "Request Approved", description: `Mobile load for Rs ${amount.toFixed(2)} marked as completed.`, className: "bg-green-500/20" });
      } else { // 'rejected'
        if (walletTransactionId) {
          updates[`walletTransactions/${userId}/${walletTransactionId}/status`] = 'rejected';
          updates[`walletTransactions/${userId}/${walletTransactionId}/description`] = `Mobile Load request to ${request.phoneNumber} rejected.`;
        
          const userWalletRef = ref(database, `users/${userId}/wallet`);
          await runTransaction(userWalletRef, (balance) => (Number(balance) || 0) + amount);
          
          const refundTx: Omit<WalletTransaction, 'id'> = {
            type: 'refund',
            amount,
            status: 'completed',
            date: new Date().toISOString(),
            description: `Refund for rejected Mobile Load to ${request.phoneNumber}`,
            relatedRequestId: requestId,
          };
          await push(ref(database, `walletTransactions/${userId}`), refundTx);
        }
        toast({ title: "Request Rejected", description: `Request rejected. Rs ${amount.toFixed(2)} refunded to user.`, className: "bg-blue-500/20" });
      }

      await update(ref(database), updates);
    } catch (error: any) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to delete this request? This action is for cleanup and will NOT refund the user.")) {
      return;
    }
    await remove(ref(database, `mobileLoadRequests/${requestId}`));
    toast({ title: "Request Deleted", description: "The request has been removed." });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle title="Manage Mobile Load Requests" subtitle="Review and process user mobile top-up requests." />
      
      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <Smartphone className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">Process Flow</AlertTitle>
        <AlertDescription className="!text-primary/80">
          Approving a request marks it as completed. Rejecting a request automatically refunds the held amount to the user's wallet.
        </AlertDescription>
      </Alert>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold">All Requests</h3>
        </div>
        <div className="relative flex-1">
          <ScrollArea className="absolute inset-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                  <TableHead>User</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Requested</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">No mobile load requests found.</TableCell></TableRow>
                ) : requests.map((req) => (
                  <TableRow key={req.id} className="border-b-border/20 hover:bg-muted/20">
                    <TableCell>{req.username || 'N/A'}</TableCell>
                    <TableCell className="font-mono">{req.phoneNumber}</TableCell>
                    <TableCell>{req.network}</TableCell>
                    <TableCell className="text-right font-semibold"><RupeeIcon className="inline h-3.5"/> {req.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-center text-xs">{new Date(req.requestDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center"><Badge variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">{req.status}</Badge></TableCell>
                    <TableCell className="text-center">
                      {req.status === 'pending' && (
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400" onClick={() => handleUpdateStatus(req.id, 'completed')} disabled={isUpdating[req.id]} title="Approve">
                            {isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleUpdateStatus(req.id, 'rejected')} disabled={isUpdating[req.id]} title="Reject">
                            {isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                      {req.status !== 'pending' && (
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteRequest(req.id)} title="Delete Request"><Trash2 className="h-4 w-4" /></Button>
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
  );
}
