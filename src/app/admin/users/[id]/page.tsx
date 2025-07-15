"use client";
import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { User, WalletTransaction } from '@/types';
import { ArrowLeft, Loader2, UserCircle, Mail, Phone, Wallet as WalletIcon, Gamepad2, Calendar, ShieldCheck, UserCheck, UserX, Gift, Percent, Clock, ExternalLink } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const DetailItem: React.FC<{ icon: React.ElementType; label: string; value?: string | number | null; children?: React.ReactNode; className?: string }> = ({ icon: Icon, label, value, children, className }) => (
  <div className={`flex items-start space-x-3 py-2 ${className}`}>
    <Icon className="h-5 w-5 text-accent mt-1 shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {children || <p className="font-medium text-foreground">{value ?? <span className="italic text-muted-foreground/70">Not set</span>}</p>}
    </div>
  </div>
);

export default function AdminViewUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!userId || !database) {
      setFetchError("Invalid user ID or database not available.");
      setIsLoading(false);
      if (!database) toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        setUser({ id: snapshot.key, ...snapshot.val() } as User);

        // Fetch recent transactions
        const transactionsQuery = query(ref(database, `walletTransactions/${userId}`), orderByChild('date'), limitToLast(10));
        const txSnapshot = await get(transactionsQuery);
        if (txSnapshot.exists()) {
          const txData = txSnapshot.val();
          const loadedTransactions: WalletTransaction[] = Object.keys(txData)
            .map(id => ({ id, ...txData[id] }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(loadedTransactions);
        }

      } else {
        setFetchError("User not found.");
        toast({ title: "Not Found", description: `User with ID ${userId} not found.`, variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error fetching user details for admin view:", err);
      setFetchError(err.message || "Could not load user data.");
      toast({ title: "Fetch Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="ml-4 text-lg">Loading user details...</p>
      </div>
    );
  }

  if (fetchError || !user) {
    return (
      <GlassCard className="m-4 p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading User</h2>
        <p className="text-muted-foreground mb-4">{fetchError || "User data could not be retrieved."}</p>
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
          </Link>
        </Button>
      </GlassCard>
    );
  }
  
  const userCreatedAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
  const lastLoginDate = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-accent" />
            <div>
                <h1 className="text-3xl font-bold text-foreground">User Details</h1>
                <p className="text-muted-foreground">Viewing profile for: {user.username}</p>
            </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
            <GlassCard className="p-6 text-center">
                 <Avatar className="h-32 w-32 mx-auto mb-4 text-muted-foreground border-4 border-accent">
                    <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                    <AvatarFallback className="text-5xl">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                 </Avatar>
                <h2 className="text-2xl font-bold text-foreground">{user.username}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-3 space-x-2">
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>{user.role}</Badge>
                    <Badge variant={user.isActive ? 'default' : 'outline'} className={user.isActive ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'border-red-500/30 text-red-400'}>
                        {user.isActive ? <UserCheck className="mr-1 h-3 w-3"/> : <UserX className="mr-1 h-3 w-3"/>}
                        {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </GlassCard>
             <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Key Info</h3>
                <Separator className="mb-3 bg-border/30"/>
                <DetailItem icon={WalletIcon} label="Wallet Balance">
                     <span className="font-bold text-xl text-green-400 flex items-center"><RupeeIcon className="inline h-4 mr-1"/> {user.wallet.toFixed(2)}</span>
                </DetailItem>
                <DetailItem icon={Calendar} label="Joined Date" value={userCreatedAt} />
                <DetailItem icon={Clock} label="Last Login" value={lastLoginDate} />
                <DetailItem icon={UserCircle} label="User ID (Firebase UID)" value={user.id} className="text-xs"/>
            </GlassCard>
        </div>
        
        <div className="md:col-span-2 space-y-6">
            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Contact &amp; Game Info</h3>
                <Separator className="mb-3 bg-border/30"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <DetailItem icon={Phone} label="Phone Number" value={user.phone} />
                    <DetailItem icon={Gamepad2} label="In-Game Name (IGN)" value={user.gameName} />
                    <DetailItem icon={ShieldCheck} label="In-Game UID" value={user.gameUid} />
                </div>
            </GlassCard>
            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Referral Information</h3>
                <Separator className="mb-3 bg-border/30"/>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <DetailItem icon={Gift} label="User's Referral Code" value={user.referralCode} />
                    <DetailItem icon={ExternalLink} label="Applied Friend's Code" value={user.appliedReferralCode} />
                    <DetailItem icon={Percent} label="Bonus Received" value={user.referralBonusReceived ? `Rs ${user.referralBonusReceived.toFixed(2)}` : 'Rs 0.00'} />
                    <DetailItem icon={WalletIcon} label="Total Commissions Earned" value={user.totalReferralCommissionsEarned ? `Rs ${user.totalReferralCommissionsEarned.toFixed(2)}` : 'Rs 0.00'} />
                 </div>
            </GlassCard>
        </div>
      </div>

      <GlassCard className="p-0">
          <div className="p-4 border-b border-border/30">
            <h3 className="text-lg font-semibold text-foreground">Recent Wallet Transactions (Last 10)</h3>
          </div>
          {transactions.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{new Date(tx.date).toLocaleDateString()}</TableCell>
                      <TableCell>{tx.description || tx.type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : '-'}<RupeeIcon className="inline h-3"/>{Math.abs(tx.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                          className={
                            tx.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                            tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="p-6 text-center text-muted-foreground">No wallet transactions found for this user.</p>
          )}
        </GlassCard>
    </div>
  );
}
