
"use client";

import { useState, useEffect, useCallback } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Hourglass, RefreshCcw, AlertCircle, Trash2, UserCircle } from 'lucide-react';
import type { WithdrawRequest, WalletTransaction, User as AppUserType, GlobalSettings } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { database } from '@/lib/firebase/config';
import { ref, onValue, off, update, runTransaction, push, remove, get, query, orderByChild, equalTo } from 'firebase/database';
import PageTitle from '@/components/core/page-title';


export default function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [adminFeeWalletUid, setAdminFeeWalletUid] = useState<string | null>(null);

  const [feeRecipients, setFeeRecipients] = useState<Record<string, { name: string; id: string } | null>>({});
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  // Function to fetch fee recipient for a single request
  const fetchFeeRecipient = useCallback(async (request: WithdrawRequest): Promise<{ name: string; id: string } | null> => {
    try {
        const userRef = ref(database, `users/${request.uid}`);
        const userSnapshot = await get(userRef);
        if (!userSnapshot.exists()) return null;

        const userData = userSnapshot.val() as AppUserType;
        const appliedCode = userData.appliedReferralCode;

        if (appliedCode) {
            const delegatesRef = query(ref(database, 'users'), orderByChild('referralCode'), equalTo(appliedCode));
            const delegateSnapshot = await get(delegatesRef);
            if (delegateSnapshot.exists()) {
                const delegateData = delegateSnapshot.val();
                const delegateId = Object.keys(delegateData)[0];
                if (delegateData[delegateId]?.role === 'delegate') {
                    return { id: delegateId, name: delegateData[delegateId].username || 'Unnamed Delegate' };
                }
            }
        }
        return null; // No delegate found
    } catch (error) {
        console.error(`Failed to fetch recipient for request ${request.id}`, error);
        return null;
    }
  }, []);

  // Effect to fetch all recipients when withdrawals data changes
  useEffect(() => {
    if (withdrawals.length > 0) {
      setIsLoadingRecipients(true);
      const fetchAll = async () => {
        const recipientsData: Record<string, { name: string; id: string } | null> = {};
        for (const req of withdrawals) {
          recipientsData[req.id] = await fetchFeeRecipient(req);
        }
        setFeeRecipients(recipientsData);
        setIsLoadingRecipients(false);
      };
      fetchAll();
    }
  }, [withdrawals, fetchFeeRecipient]);


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
        })).sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()); // Sort by requestDate descending
        setWithdrawals(loadedWithdrawals);
      } else {
        setWithdrawals([]);
      }
      setIsLoading(false);
    }, (errorObject: Error) => { 
      console.error("Error fetching withdrawals:", errorObject);
      let description = "Could not load withdrawal requests.";
      if (errorObject.message && errorObject.message.toLowerCase().includes('permission_denied')) {
        description = "Permission Denied. Please check your Firebase Realtime Database security rules to allow admins to read /withdrawRequests.";
      }
      toast({ title: "Fetch Error", description, variant: "destructive" });
      setIsLoading(false);
    });

    const settingsRef = ref(database, 'globalSettings/tokenSettings/adminFeeWalletUid');
    const settingsListener = onValue(settingsRef, (snapshot) => {
        setAdminFeeWalletUid(snapshot.val() || null);
    });

    return () => {
      if (database) { 
        off(withdrawalsRef, 'value', listener);
        off(settingsRef, 'value', settingsListener);
      }
    };
  }, [toast]);

  const handleUpdateStatus = async (requestId: string, newAdminDecision: 'approved' | 'rejected') => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }
    setIsUpdating(prev => ({ ...prev, [requestId]: true }));
    
    const requestToUpdate = withdrawals.find(w => w.id === requestId);
    if (!requestToUpdate) {
      toast({ title: "Error", description: "Withdrawal request not found.", variant: "destructive" });
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
      return;
    }

    const { uid: userId, amount, walletTransactionId } = requestToUpdate;

    if (!userId || !walletTransactionId) {
        toast({ title: "Data Error", description: "Request is missing user ID or original transaction link. Cannot process.", variant: "destructive" });
        setIsUpdating(prev => ({ ...prev, [requestId]: false }));
        return;
    }

    try {
      const updates: Record<string, any> = {};
      updates[`withdrawRequests/${requestId}/processedDate`] = new Date().toISOString();

      if (newAdminDecision === 'approved') {
        updates[`withdrawRequests/${requestId}/status`] = 'completed';
        updates[`walletTransactions/${userId}/${walletTransactionId}/status`] = 'completed';
        updates[`walletTransactions/${userId}/${walletTransactionId}/description`] = `Withdrawal to ${requestToUpdate.method || 'account'} completed.`;

        // Use pre-fetched recipient data
        const delegate = feeRecipients[requestId];
        const feeAmount = requestToUpdate.amount * 0.05;

        if (delegate && delegate.id) {
            // Logic for referred user: give commission to delegate
            const delegateWalletRef = ref(database, `users/${delegate.id}/wallet`);
            await runTransaction(delegateWalletRef, (currentBalance) => (currentBalance || 0) + feeAmount);
            
            const commissionTx: Omit<WalletTransaction, 'id'> = {
                type: 'referral_commission_earned', amount: feeAmount, status: 'completed',
                date: new Date().toISOString(),
                description: `5% fee from ${requestToUpdate.username}'s withdrawal of Rs ${requestToUpdate.amount.toFixed(2)}`,
            };
            await push(ref(database, `walletTransactions/${delegate.id}`), commissionTx);
        } else if (adminFeeWalletUid) {
            // Logic for non-referred user: give fee to admin
            const adminWalletRef = ref(database, `users/${adminFeeWalletUid}/wallet`);
            await runTransaction(adminWalletRef, (currentBalance) => (currentBalance || 0) + feeAmount);
            
            const adminFeeTx: Omit<WalletTransaction, 'id'> = {
                type: 'fee_collected', amount: feeAmount, status: 'completed',
                date: new Date().toISOString(),
                description: `5% fee from ${requestToUpdate.username}'s withdrawal of Rs ${requestToUpdate.amount.toFixed(2)}`,
            };
            await push(ref(database, `walletTransactions/${adminFeeWalletUid}`), adminFeeTx);
        } else {
             console.warn("Withdrawal fee could not be processed: No delegate found and admin fee wallet is not set.");
        }


        toast({ title: "Request Approved", description: `Withdrawal for Rs ${amount.toFixed(2)} finalized.`, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });

      } else if (newAdminDecision === 'rejected') {
        updates[`withdrawRequests/${requestId}/status`] = 'rejected';
        updates[`walletTransactions/${userId}/${walletTransactionId}/status`] = 'rejected';
        updates[`walletTransactions/${userId}/${walletTransactionId}/description`] = 'Withdrawal request rejected.';

        const userWalletRef = ref(database, `users/${userId}/wallet`);
        const refundResult = await runTransaction(userWalletRef, (currentBalance) => {
          return (Number(currentBalance) || 0) + amount;
        });

        if (!refundResult.committed) {
          throw new Error("Failed to refund amount to user's wallet. Please check user's balance manually.");
        }
        
        const refundTransactionData: Omit<WalletTransaction, 'id'> = {
          type: 'refund',
          amount: amount, 
          status: 'completed',
          date: new Date().toISOString(),
          description: `Withdrawal request (ID: ${requestId.substring(0,6)}...) rejected - amount refunded.`,
          relatedRequestId: requestId,
        };
        const userTransactionsRef = ref(database, `walletTransactions/${userId}`);
        await push(userTransactionsRef, refundTransactionData);
        
        toast({ title: "Request Rejected & Refunded", description: `Request rejected. Rs ${amount.toFixed(2)} refunded to user.`, variant: "default", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" });
      }
      
      await update(ref(database), updates);

    } catch (error: any) {
      console.error("Error updating status:", error);
      let toastDescription = error.message || "Failed to update status.";
      if (String(error.message).toLowerCase().includes('permission_denied')) {
        toastDescription = "Permission Denied. Check Firebase rules for writing to /withdrawRequests, /users/{uid}/wallet, and /walletTransactions/{uid}.";
      }
      toast({ title: "Update Error", description: toastDescription, variant: "destructive" });
    } finally {
      setIsUpdating(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleDeleteAllRequests = async () => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }

    if (!confirm("Are you absolutely sure you want to delete ALL withdrawal requests? This action cannot be undone and will remove all historical records.")) {
      return;
    }

    setIsDeletingAll(true);

    try {
      await remove(ref(database, 'withdrawRequests'));
      toast({ title: "All Requests Deleted", description: "All withdrawal requests have been successfully deleted.", variant: "default" });
    } catch (error: any) {
      console.error("Error deleting all requests:", error);
      let toastDescription = error.message || "Failed to delete all requests.";
      if (String(error.message).toLowerCase().includes('permission_denied')) {
        toastDescription = "Permission Denied. Check Firebase rules for writing (deleting) to /withdrawRequests.";
      }
      toast({ title: "Deletion Error", description: toastDescription, variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };


  const handleDeleteRequest = async (requestId: string) => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }

    if (!confirm("Are you sure you want to delete this withdrawal request? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(prev => ({ ...prev, [requestId]: true }));

    try {
      await remove(ref(database, `withdrawRequests/${requestId}`));
      toast({ title: "Request Deleted", description: "Withdrawal request has been successfully deleted.", variant: "default" });
    } catch (error: any) {
      console.error("Error deleting request:", error);
      let toastDescription = error.message || "Failed to delete request.";
      if (String(error.message).toLowerCase().includes('permission_denied')) {
        toastDescription = "Permission Denied. Check Firebase rules for writing (deleting) to /withdrawRequests.";
      }
      toast({ title: "Deletion Error", description: toastDescription, variant: "destructive" });
    } finally {
      setIsDeleting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCcw className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageTitle title="Manage Withdrawal Requests" subtitle="Review and process user withdrawal requests." />
        <Button
          variant="destructive"
          onClick={handleDeleteAllRequests}
          disabled={isDeletingAll || withdrawals.length === 0}
          className="flex items-center gap-2"
        >
          {isDeletingAll ? <Hourglass className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          Delete All Requests
        </Button>
      </div>
      
      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">Important Process Note</AlertTitle>
        <AlertDescription className="!text-primary/80">
          Approving a request finalizes payment. If the user was referred by a delegate, 5% of the withdrawal amount is sent to the delegate. If not referred, 5% is sent to the admin's fee wallet. Rejecting a request refunds the held amount to the user's wallet.
        </AlertDescription>
      </Alert>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold">Pending & Recent Requests</h3>
        </div>
        <div className="relative flex-1">
          <ScrollArea className="absolute inset-0">
            <TooltipProvider>
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                  <TableHead>User</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Account No.</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee (5%)</TableHead>
                  <TableHead className="text-right">Net Payout</TableHead>
                  <TableHead className="text-center">Requested</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      No withdrawal requests found.
                    </TableCell>
                  </TableRow>
                )}
                {withdrawals.map((req) => {
                  const recipient = feeRecipients[req.id];
                  return (
                  <TableRow key={req.id} className="border-b-border/20 hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p>{req.username || 'N/A'}</p>
                        <p className="text-xs font-mono text-muted-foreground" title={req.uid}>{req.uid.substring(0,10)}...</p>
                      </div>
                    </TableCell>
                    <TableCell>{req.method}</TableCell>
                    <TableCell>{req.accountNumber}</TableCell>
                    <TableCell className="text-right font-semibold"><RupeeIcon className="inline h-3.5 w-auto mr-0.5" /> {req.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-400 font-mono">
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-red-400/50">
                              <RupeeIcon className="inline h-3 w-auto mr-0.5" /> 
                              {(req.amount * 0.05).toFixed(2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="glass-card">
                            {isLoadingRecipients ? (
                              <p>Loading recipient...</p>
                            ) : recipient ? (
                              <div>
                                <p className="font-semibold">Fee to Delegate:</p>
                                <p className="text-xs text-muted-foreground">{recipient.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{recipient.id}</p>
                              </div>
                            ) : (
                              <p>Fee to Admin Wallet</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-400"><RupeeIcon className="inline h-3.5 w-auto mr-0.5" /> {(req.amount * 0.95).toFixed(2)}</TableCell>
                    <TableCell className="text-center text-xs">{new Date(req.requestDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                         variant={
                          req.status === 'completed' ? 'default' :
                          req.status === 'pending' ? 'secondary' :
                          'destructive' 
                        }
                        className={
                          req.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          'bg-red-500/20 text-red-300 border-red-500/30' // For 'rejected'
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {req.status === 'pending' && (
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400 hover:text-green-300" onClick={() => handleUpdateStatus(req.id, 'approved')} disabled={isUpdating[req.id]} title="Approve & Finalize">
                            {isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => handleUpdateStatus(req.id, 'rejected')} disabled={isUpdating[req.id]} title="Reject & Refund">
                            {isUpdating[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                      {req.status !== 'pending' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400" onClick={() => handleDeleteRequest(req.id)} disabled={isDeleting[req.id]} title="Delete Request">
                          {isDeleting[req.id] ? <Hourglass className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TooltipProvider>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </GlassCard>
    </div>
  );
}

