
"use client";

import { useState, useEffect } from 'react';
import type { TokenTransaction } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { Loader2, Coins, ArrowRightLeft } from 'lucide-react';
import GlassCard from '@/components/core/glass-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '../ui/badge';
import RupeeIcon from '../core/rupee-icon';

interface TokenTransactionListProps {
    userId: string;
    tokenSymbol: string;
}

export default function TokenTransactionList({ userId, tokenSymbol }: TokenTransactionListProps) {
    const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        const transactionsQuery = query(
            ref(database, `tokenTransactions/${userId}`),
            orderByChild('date'),
            limitToLast(50)
        );

        const unsubscribe = onValue(transactionsQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedTxs = Object.keys(data).map(id => ({ id, ...data[id] }) as TokenTransaction);
                setTransactions(loadedTxs.sort((a, b) => b.date - a.date));
            } else {
                setTransactions([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching token transactions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const getTransactionTypeStyle = (type: TokenTransaction['type']) => {
        switch (type) {
            case 'buy':
            case 'transfer_in':
            case 'fee_collected':
                return 'text-green-400';
            case 'sell':
            case 'transfer_out':
            case 'spend_entry':
            case 'spend_shop':
            case 'fee_paid':
                return 'text-red-400';
            default:
                return 'text-muted-foreground';
        }
    };

    return (
        <GlassCard className="p-0">
            <div className="p-6 border-b border-border/30">
                <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                    <ArrowRightLeft className="h-6 w-6 text-accent"/>
                    Token History
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Your recent token transactions.</p>
            </div>
            {loading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
            ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No token transactions yet.</p>
            ) : (
                <ScrollArea className="h-[400px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id} className="border-b-border/20">
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">{tx.type.replace(/_/g, ' ')}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-medium text-foreground">{tx.description}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleString()}</p>
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${getTransactionTypeStyle(tx.type)}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} {tokenSymbol}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
        </GlassCard>
    );
}
