
"use client";

import React, { useEffect, useState } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, remove } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import type { WalletTransaction as Transaction } from '@/types';
import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import RupeeIcon from '@/components/core/rupee-icon';


export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!database) {
      setError("Firebase Database not initialized.");
      setIsLoading(false);
      return;
    }

    const transactionsRef = ref(database, 'walletTransactions');

    const unsubscribe = onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      const allTransactions: Transaction[] = [];

      if (data) {
        Object.keys(data).forEach(userId => {
          const userTransactions = data[userId];
          if (userTransactions) {
            Object.keys(userTransactions).forEach(transactionId => {
              const transaction = userTransactions[transactionId];
              allTransactions.push({ id: transactionId, userId: userId, ...transaction });
            });
          }
        });
      }

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
      setIsLoading(false);
      setError(null);
    }, (dbError) => {
      console.error("Error fetching transactions:", dbError);
      setError("Failed to load transaction history. Please check console for details.");
      setIsLoading(false);
    });

    return () => {
      off(transactionsRef, 'value', unsubscribe);
    };
  }, []);

  const handleClearAllTransactions = async () => {
    if (!database) {
      console.error("Firebase Database not initialized.");
      return;
    }

    const isConfirmed = window.confirm("Are you sure you want to clear ALL user transaction history? This action cannot be undone.");

    if (isConfirmed) {
      setIsClearing(true);
      const transactionsRef = ref(database, 'walletTransactions');
      try {
        await remove(transactionsRef);
        console.log("All transaction history cleared successfully.");
      } catch (clearError: any) {
        console.error("Error clearing transactions:", clearError);
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageTitle title="All User Transaction History" subtitle="View a complete log of all wallet activities across the platform."/>
        <Button onClick={handleClearAllTransactions} disabled={isClearing || isLoading} variant="destructive">
          {isClearing ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />}
          {isClearing ? 'Clearing...' : 'Clear All Transactions'}
        </Button>
      </div>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" /><p className="ml-3 text-muted-foreground">Loading transactions...</p>
          </div>
        ) : error ? (
            <div className="p-6 text-center text-destructive">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="flex-1 flex justify-center items-center text-muted-foreground">No transaction history found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                  <TableHead>Date</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tx => (
                  <TableRow key={tx.id} className="border-b-border/20 hover:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.date).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tx.userId}</TableCell>
                    <TableCell className="text-sm capitalize">{(tx.type || '-').replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-sm text-foreground max-w-xs truncate">{tx.description || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                         variant={
                          tx.status === 'completed' ? 'default' :
                          tx.status === 'pending' || tx.status === 'on_hold' ? 'secondary' :
                          'destructive' 
                        }
                        className={
                          tx.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          tx.status === 'pending' || tx.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }
                      >
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : '-'}<RupeeIcon className="inline h-3.5"/>{Math.abs(tx.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
