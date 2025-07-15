
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, Trash2, Search, BadgeCheck, BadgeX, Loader2, UserPlus as UserPlusIconLucide, UserCircle, BarChart3 as MatchesIcon, Download, ShieldCheck as RoleIcon, Phone as PhoneIcon, Gamepad2 as GamepadIcon, CalendarDays, Clock, Gift as ReferralIcon, Wallet as WalletIcon, PlusCircle as TopUpIcon, Coins } from 'lucide-react';
import Link from 'next/link';
import type { User, WalletTransaction, LeaderboardData, Tournament, GlobalSettings } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import RupeeIcon from '@/components/core/rupee-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, remove, onValue, off, update } from 'firebase/database';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentDelete,
  AlertDialogDescription as AlertDialogDescriptionDelete,
  AlertDialogFooter as AlertDialogFooterDelete,
  AlertDialogHeader as AlertDialogHeaderDelete,
  AlertDialogTitle as AlertDialogTitleDelete,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


type UserStatusFilter = "all" | "active" | "inactive";
type UserRoleFilter = "all" | "admin" | "user" | "delegate";

interface UserAggregatedData {
  matchesJoined: number;
  matchesWon: number;
 totalWithdrawn: number | string;
  totalToppedUp: number | string; 
}

const DetailItemDialog: React.FC<{ icon: React.ElementType; label: string; value?: string | number | null | React.ReactNode; className?: string; valueClassName?: string }> = ({ icon: Icon, label, value, children, className, valueClassName }) => (
  <div className={cn("flex items-start space-x-2 py-1.5", className)}>
    <Icon className="h-4 w-4 text-accent mt-0.5 shrink-0" />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children || <p className={cn("text-sm font-medium text-foreground", valueClassName)}>{value ?? <span className="italic text-muted-foreground/70">N/A</span>}</p>}
    </div>
  </div>
);


export default function AdminUsersPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');  
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all');
  const [minWalletBalance, setMinWalletBalance] = useState<number | ''>('');
  const { toast } = useToast();

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [selectedUserForDialog, setSelectedUserForDialog] = useState<User | null>(null);
  const [selectedUserAggregatedData, setSelectedUserAggregatedData] = useState<UserAggregatedData | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false); 
  const [dialogSelectedRole, setDialogSelectedRole] = useState<Exclude<UserRoleFilter, 'all'>>('user');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [isUserDetailsDialogOpen, setIsUserDetailsDialogOpen] = useState(false);
  const [tokenSettings, setTokenSettings] = useState<GlobalSettings['tokenSettings'] | null>(null);


  useEffect(() => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const usersRefQuery = query(ref(database, 'users'), orderByChild('username'));
    
    const listener = onValue(usersRefQuery, (snapshot) => {
      if (snapshot.exists()) {
        const usersData: { [key: string]: any } = snapshot.val();
        const loadedUsers: User[] = Object.keys(usersData).map(id => ({
          id,
          username: usersData[id].username || 'N/A',
          email: usersData[id].email || 'N/A',
          phone: usersData[id].phone,
          wallet: usersData[id].wallet || 0,
          tokenWallet: usersData[id].tokenWallet || 0,
          role: usersData[id].role || 'user',
          isActive: usersData[id].isActive !== undefined ? usersData[id].isActive : false,
          lastLogin: usersData[id].lastLogin || new Date(0).toISOString(),
          onlineStreak: usersData[id].onlineStreak || 0,
          avatarUrl: usersData[id].avatarUrl,
          gameUid: usersData[id].gameUid,
          gameName: usersData[id].gameName,
          createdAt: usersData[id].createdAt || new Date(0).toISOString(),
          referralCode: usersData[id].referralCode,
          appliedReferralCode: usersData[id].appliedReferralCode,
          referralBonusReceived: usersData[id].referralBonusReceived || 0,
          totalReferralCommissionsEarned: usersData[id].totalReferralCommissionsEarned || 0,
        }));
        setAllUsers(loadedUsers);
      } else {
        setAllUsers([]);
      }
      setIsLoading(false);
    }, (error: Error) => {
      console.error("AdminUsersPage: Error fetching users from Firebase:", error.message);
      const description = String(error.message).toUpperCase().includes("PERMISSION_DENIED")
        ? "Permission Denied. Check Firebase rules for reading /users path by admin and ensure '.indexOn': 'username' is set."
        : "Could not load users.";
      toast({ title: "Fetch Error", description, variant: "destructive" });
      setIsLoading(false);
    });

    const settingsRef = ref(database, 'globalSettings/tokenSettings');
    const settingsListener = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            setTokenSettings(snapshot.val());
        } else {
            setTokenSettings(null);
        }
    });
    
    return () => {
        if (database) {
            off(usersRefQuery, 'value', listener);
            off(settingsRef, 'value', settingsListener);
        }
    };
  }, [toast]);

  const displayedUsers = useMemo(() => {
    return allUsers
      .filter(user => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          user.username.toLowerCase().includes(lowerSearchTerm) ||
          user.email.toLowerCase().includes(lowerSearchTerm) ||
          user.id.toLowerCase().includes(lowerSearchTerm)
        );
      })
      .filter(user => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'active' ? user.isActive : !user.isActive;
      })
      .filter(user => {
        if (roleFilter === 'all') return true;
        return user.role === roleFilter;
      });
  }, [allUsers, searchTerm, statusFilter, roleFilter]); 

  const filteredUsersByBalance = useMemo(() => {
      return displayedUsers.filter(user => minWalletBalance === '' || user.wallet >= minWalletBalance);
  }, [displayedUsers, minWalletBalance]);

  const handleDeleteUser = async () => {
    if (!userToDelete || !userToDelete.id || !database) {
      toast({ title: "Error", description: "No user selected or database error.", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    try {
      await remove(ref(database, `users/${userToDelete.id}`));
      toast({
        title: "User Deleted from Database",
        description: `User "${userToDelete.username}" data removed from Realtime Database. Auth account still exists.`,
        variant: "default",
        className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        duration: 7000,
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Error deleting user data:", error);
      let description = "Could not delete user data.";
      if (String(error.message).toUpperCase().includes("PERMISSION_DENIED")) {
        description = "Permission Denied. Check Firebase rules for deleting from /users.";
      }
      toast({ title: "Deletion Failed", description, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenUserDetailsDialog = useCallback(async (user: User) => {
    setSelectedUserForDialog(user); 
    setIsDialogLoading(true);
    setIsUserDetailsDialogOpen(true);
    setSelectedUserAggregatedData(null); 
    setDialogSelectedRole(user.role as Exclude<UserRoleFilter, 'all'>);

    if (!database) {
      toast({ title: "DB Error", description: "Database not available for fetching details.", variant: "destructive"});
      setIsDialogLoading(false);
      return;
    }

    let matchesJoinedCount = 0;
    let matchesWonCount = 0;
    let totalWithdrawn: number | string = 0;
    let totalToppedUp: number | string = 0;

    try {
      const tournamentsRef = ref(database, 'tournaments');
      const tournamentsSnapshot = await get(tournamentsRef);
      if (tournamentsSnapshot.exists()) {
        const allTournaments = tournamentsSnapshot.val();
        Object.values(allTournaments).forEach((tournament: any) => {
          if (tournament.playersJoined && tournament.playersJoined[user.id]) {
            matchesJoinedCount++;
          }
        });
      }
    } catch (error: any) {
        console.error("Error fetching tournament data for user dialog:", error);
        toast({ title: "Details Error", description: "Could not load matches joined. " + error.message, variant: "destructive" });
    }

    try {
      const leaderboardRef = ref(database, `leaderboards/${user.id}`);
      const leaderboardSnapshot = await get(leaderboardRef);
      if (leaderboardSnapshot.exists()) {
        matchesWonCount = (leaderboardSnapshot.val() as LeaderboardData).wins || 0;
      }
    } catch (error: any) {
        console.error("Error fetching leaderboard data for user dialog:", error);
        toast({ title: "Details Error", description: "Could not load matches won. " + error.message, variant: "destructive" });
    }

    try {
      const transactionsRefPath = `walletTransactions/${user.id}`;
      const transactionsRef = ref(database, transactionsRefPath);
      const transactionsSnapshot = await get(transactionsRef);
      
      if (transactionsSnapshot.exists()) {
        const allTransactions = transactionsSnapshot.val();
        Object.values(allTransactions).forEach((transaction: any) => {
          if (transaction.type === 'withdrawal' && transaction.status === 'completed') {
            (totalWithdrawn as number) += Math.abs(transaction.amount);
          } else if (transaction.type === 'topup' && transaction.status === 'completed') {
            (totalToppedUp as number) += transaction.amount;
          }
        });
      } else {
         console.warn(`No wallet transactions found at ${transactionsRefPath}`);
      }
    } catch (error: any) { 
        const errorMessage = String(error.message || error).toUpperCase();
        if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("PERMISSION DENIED")) {
            console.warn(
              `AdminUsersPage Dialog: PERMISSION DENIED while fetching wallet transactions for user ${user.id}. ` +
              `Path: /walletTransactions/${user.id}. Ensure Firebase rules allow admin read access.`
            );
            toast({ title: "Permission Issue", description: `Cannot load transaction history for ${user.username} due to database permissions.`, variant: "destructive", duration: 7000});
            totalWithdrawn = "N/A";
            totalToppedUp = "N/A";
        } else {
            console.error("Error fetching wallet transactions for user dialog:", error);
            toast({ title: "Transaction Error", description: "Could not load transaction history. " + error.message, variant: "destructive" });
            totalWithdrawn = "Error";
            totalToppedUp = "Error";
        }
    }
      
    setSelectedUserAggregatedData({
      matchesJoined: matchesJoinedCount,
      matchesWon: matchesWonCount,
      totalWithdrawn: totalWithdrawn,
      totalToppedUp: totalToppedUp,
    });
    setIsDialogLoading(false); 
  }, [toast]);

  const handleRoleChange = async (newRole: UserRoleFilter) => {
    if (!selectedUserForDialog || !selectedUserForDialog.id || !database) {
        toast({ title: "Error", description: "No user selected or database not available.", variant: "destructive" });
        return;
    }
    if (newRole === selectedUserForDialog.role) {
        setDialogSelectedRole(newRole as Exclude<UserRoleFilter, 'all'>);
        return;
    }

    setIsUpdatingRole(true);
    try {
        await update(ref(database, `users/${selectedUserForDialog.id}`), {
            role: newRole
        });
        setDialogSelectedRole(newRole as Exclude<UserRoleFilter, 'all'>);
        toast({ title: "Success", description: `User role updated to "${newRole}".`, variant: "default" });
        setAllUsers(prevUsers => prevUsers.map(u => u.id === selectedUserForDialog.id ? { ...u, role: newRole as 'user' | 'admin' | 'delegate' } : u));
    } catch (error: any) {
        console.error("Error updating user role:", error);
        toast({ title: "Update Failed", description: "Could not update user role. " + error.message, variant: "destructive" });
    } finally {
        setIsUpdatingRole(false);
    }
};

  if (isLoading && !allUsers.length) { 
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteDialogOpen(isOpen);
          if (!isOpen) setUserToDelete(null);
        }}
      >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
                <UserPlusIconLucide className="mr-3 h-8 w-8 text-accent" /> User Management
              </h1>
              <p className="text-muted-foreground">View, filter, and manage platform users.</p>
            </div>
          </div>

          <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
            <div className="p-4 border-b border-border/30 space-y-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, email, or ID..."
                  className="pl-10 w-full bg-input/50 border-border/70 focus:border-accent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex w-max space-x-4 pb-2">
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UserStatusFilter)} >
                        <SelectTrigger className="w-[180px] bg-input/30 border-border/50">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent className="glass-card">
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRoleFilter)} >
                        <SelectTrigger className="w-[180px] bg-input/30 border-border/50">
                            <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent className="glass-card">
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        placeholder="Min Wallet Balance"
                        className="w-[180px] bg-input/50 border-border/70 focus:border-accent"
                        value={minWalletBalance}
                        onChange={(e) => setMinWalletBalance(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    />
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            <ScrollArea className="w-full whitespace-nowrap">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Role</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Wallet</TableHead>
                      <TableHead className="text-center w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && filteredUsersByBalance.length === 0 ? (
                       <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" /></TableCell></TableRow>
                    ) : filteredUsersByBalance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          {allUsers.length === 0 ? "No users found." : "No users match your current filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsersByBalance.map((user) => (
                        <TableRow key={user.id} className="border-b-border/20 hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 text-muted-foreground flex-shrink-0">
                                <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                                <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{user.username}</p>
                                <p className="text-xs text-muted-foreground">ID: {user.id.substring(0, 8)}...</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {user.isActive ?
                              <BadgeCheck className="h-5 w-5 text-green-500 inline-block" title="Active" /> :
                              <BadgeX className="h-5 w-5 text-red-500 inline-block" title="Inactive" />
                            }
                          </TableCell>
                          <TableCell className="text-right text-foreground"><RupeeIcon className="inline h-3 w-auto -mt-0.5" /> {user.wallet.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent h-8 w-8" title="View Details" onClick={() => handleOpenUserDetailsDialog(user)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 h-8 w-8" title="Edit User" asChild>
                                <Link href={`/admin/users/edit/${user.id}`}>
                                  <Edit3 className="h-4 w-4" />
                                </Link>
                              </Button>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-400 hover:text-red-300 h-8 w-8"
                                  title="Delete User Data"
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <AlertDialogContentDelete className="glass-card">
              {userToDelete && (
                <>
                  <AlertDialogHeaderDelete>
                    <AlertDialogTitleDelete>Delete User Data: {userToDelete.username}?</AlertDialogTitleDelete>
                    <AlertDialogDescriptionDelete>
                      This action will remove the user's data from the Realtime Database.
                      Their Firebase Authentication account will <span className="font-semibold text-destructive">NOT</span> be deleted by this action.
                      This cannot be undone.
                    </AlertDialogDescriptionDelete>
                  </AlertDialogHeaderDelete>
                  <AlertDialogFooterDelete>
                    <AlertDialogCancel
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setUserToDelete(null);
                      }}
                      disabled={isDeleting}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      {isDeleting ? <Loader2 className="animate-spin mr-2"/> : null}
                      Delete Database Entry
                    </AlertDialogAction>
                  </AlertDialogFooterDelete>
                </>
              )}
              {!userToDelete && isDeleteDialogOpen && (
                <AlertDialogHeaderDelete>
                    <AlertDialogTitleDelete>Error</AlertDialogTitleDelete>
                    <AlertDialogDescriptionDelete>No user selected for deletion. Please close and try again.</AlertDialogDescriptionDelete>
                     <AlertDialogFooterDelete>
                        <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Close</AlertDialogCancel>
                    </AlertDialogFooterDelete>
                </AlertDialogHeaderDelete>
              )}
            </AlertDialogContentDelete>
          </GlassCard>
      </AlertDialog>

      <Dialog open={isUserDetailsDialogOpen} onOpenChange={(isOpen) => {
        setIsUserDetailsDialogOpen(isOpen);
        if (!isOpen) { 
            setSelectedUserForDialog(null);
            setSelectedUserAggregatedData(null);
        }
      }}>
        <DialogContent className="glass-card sm:max-w-2xl p-0">
          {selectedUserForDialog ? (
            <>
              <DialogHeader className="p-4 sm:p-6 border-b border-border/30">
                <DialogTitle className="text-xl text-accent flex items-center gap-2">
                  <UserCircle className="h-6 w-6"/> User Profile: {selectedUserForDialog.username}
                </DialogTitle>
                <DialogDescription>
                  Detailed overview of the user's account and activity.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
              <div className="p-4 sm:p-6 space-y-6">
                {isDialogLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-10 w-10 animate-spin text-accent" />
                    <p className="ml-3 text-muted-foreground">Loading details...</p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-4">
                      <GlassCard className="p-4 text-center bg-card/50">
                        <Avatar className="h-24 w-24 mx-auto mb-3 border-4 border-accent">
                          <AvatarImage src={selectedUserForDialog.avatarUrl || undefined} alt={selectedUserForDialog.username}/>
                          <AvatarFallback className="text-4xl">{selectedUserForDialog.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-lg text-foreground">{selectedUserForDialog.username}</p>
                        <p className="text-xs text-muted-foreground break-all">{selectedUserForDialog.email}</p>
                         <p className="text-xs text-muted-foreground mt-1">UID: {selectedUserForDialog.id.substring(0,12)}...</p>
                      </GlassCard>
                      
                      <GlassCard className="p-3 bg-card/50">
                        <DetailItemDialog icon={WalletIcon} label="Wallet Balance" valueClassName="text-green-400 font-bold text-lg" value={<><RupeeIcon className="inline h-4"/> {selectedUserForDialog.wallet.toFixed(2)}</>} />
                      </GlassCard>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <GlassCard className="p-4 bg-card/50">
                      <h4 className="font-semibold text-md text-foreground mb-2">Account Info</h4>
                      <Separator className="mb-3 bg-border/50" />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                         <DetailItemDialog icon={RoleIcon} label="Role">
                             <Select value={dialogSelectedRole} onValueChange={(v) => handleRoleChange(v as UserRoleFilter)} disabled={isUpdatingRole}>
                                  <SelectTrigger className="w-full h-8 bg-input/30 border-border/50 text-sm">
                                    <SelectValue placeholder="Select Role"/>
                                  </SelectTrigger>
                                  <SelectContent className="glass-card">
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="delegate">Delegate</SelectItem>
                                  </SelectContent>
                             </Select>
                             {isUpdatingRole && <Loader2 className="h-4 w-4 animate-spin text-accent ml-2 inline" />}
                         </DetailItemDialog>

                        <DetailItemDialog icon={selectedUserForDialog.isActive ? BadgeCheck : BadgeX} label="Status" valueClassName={selectedUserForDialog.isActive ? 'text-green-400' : 'text-red-400'} value={selectedUserForDialog.isActive ? "Active" : "Inactive"} />
                        <DetailItemDialog icon={CalendarDays} label="Joined" value={selectedUserForDialog.createdAt ? new Date(selectedUserForDialog.createdAt).toLocaleDateString() : 'N/A'} />
                        <DetailItemDialog icon={Clock} label="Last Login" value={selectedUserForDialog.lastLogin ? new Date(selectedUserForDialog.lastLogin).toLocaleString() : 'N/A'} />
                         <DetailItemDialog icon={PhoneIcon} label="Phone" value={selectedUserForDialog.phone || 'N/A'} />
                      </div>
                    </GlassCard>
                    
                    <GlassCard className="p-4 bg-card/50">
                        <h4 className="font-semibold text-md text-foreground mb-2">Game &amp; Activity</h4>
                        <Separator className="mb-3 bg-border/50" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <DetailItemDialog icon={GamepadIcon} label="In-Game Name" value={selectedUserForDialog.gameName} />
                            <DetailItemDialog icon={GamepadIcon} label="In-Game UID" value={selectedUserForDialog.gameUid} />
                            <DetailItemDialog icon={MatchesIcon} label="Matches Joined" value={selectedUserAggregatedData?.matchesJoined ?? '...'} />
                            <DetailItemDialog icon={MatchesIcon} label="Matches Won" value={selectedUserAggregatedData?.matchesWon ?? '...'} />
                        </div>
                    </GlassCard>

                     <GlassCard className="p-4 bg-card/50">
                        <h4 className="font-semibold text-md text-foreground mb-2">Financial Overview</h4>
                        <Separator className="mb-3 bg-border/50" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <DetailItemDialog 
                                icon={TopUpIcon} 
                                label="Total Top-up" 
                                valueClassName="text-green-400" 
                                value={typeof selectedUserAggregatedData?.totalToppedUp === 'number' 
                                        ? <><RupeeIcon className="inline h-3.5"/> {selectedUserAggregatedData.totalToppedUp.toFixed(2)}</> 
                                        : selectedUserAggregatedData?.totalToppedUp || '...'} 
                            />
                            <DetailItemDialog 
                                icon={Download} 
                                label="Total Withdrawn" 
                                valueClassName="text-red-400" 
                                value={typeof selectedUserAggregatedData?.totalWithdrawn === 'number' 
                                        ? <><RupeeIcon className="inline h-3.5"/> {selectedUserAggregatedData.totalWithdrawn.toFixed(2)}</> 
                                        : selectedUserAggregatedData?.totalWithdrawn || '...'} 
                            />
                            {tokenSettings?.enabled && (
                                <>
                                    <DetailItemDialog
                                        icon={Coins}
                                        label={`${tokenSettings.tokenSymbol || 'Token'} Balance`}
                                        valueClassName="font-bold"
                                        value={(selectedUserForDialog.tokenWallet || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                                    />
                                    <DetailItemDialog
                                        icon={RupeeIcon}
                                        label="Token Value (PKR)"
                                        valueClassName="text-green-400"
                                        value={`≈ ${( (selectedUserForDialog.tokenWallet || 0) * (tokenSettings.basePrice || 0) ).toFixed(2)}`}
                                    />
                                </>
                            )}
                        </div>
                    </GlassCard>
                    
                    <GlassCard className="p-4 bg-card/50">
                        <h4 className="font-semibold text-md text-foreground mb-2">Referral Details</h4>
                        <Separator className="mb-3 bg-border/50" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <DetailItemDialog icon={ReferralIcon} label="User's Code" value={selectedUserForDialog.referralCode} />
                            <DetailItemDialog icon={ReferralIcon} label="Applied Code" value={selectedUserForDialog.appliedReferralCode} />
                            <DetailItemDialog icon={ReferralIcon} label="Bonus Received" value={<><RupeeIcon className="inline h-3.5"/> {(selectedUserForDialog.referralBonusReceived || 0).toFixed(2)}</>} />
                            <DetailItemDialog icon={ReferralIcon} label="Commissions Earned" value={<><RupeeIcon className="inline h-3.5"/> {(selectedUserForDialog.totalReferralCommissionsEarned || 0).toFixed(2)}</>} />
                        </div>
                    </GlassCard>
                  </div>
                </div>
                )}
              </div>
              </ScrollArea>
              <DialogFooter className="p-4 sm:p-6 border-t border-border/30">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
                 <Button variant="default" asChild className="neon-accent-bg">
                    <Link href={`/admin/users/edit/${selectedUserForDialog.id}`}>
                        <Edit3 className="mr-2 h-4 w-4" /> Edit User
                    </Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="p-6 text-center text-muted-foreground">Error: No user selected or user data is invalid.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    