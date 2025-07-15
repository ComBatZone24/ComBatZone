
"use client";

import { useState, useEffect, useMemo } from "react";
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, Search, Filter, Loader2, ShieldCheck as ShieldCheckIcon, BadgeCheck, BadgeX } from 'lucide-react';
import Link from 'next/link';
import type { User } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RupeeIcon from '@/components/core/rupee-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, query, orderByChild, onValue, off } from 'firebase/database';
import PageTitle from '@/components/core/page-title';
import { cn } from '@/lib/utils';

type UserStatusFilter = "all" | "active" | "inactive";

export default function AdminSubAdminsPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const { toast } = useToast();

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
        const usersData = snapshot.val();
        const loadedUsers: User[] = Object.keys(usersData)
          .map(id => ({
            id,
            username: usersData[id].username || 'N/A',
            email: usersData[id].email || 'N/A',
            phone: usersData[id].phone,
            wallet: usersData[id].wallet || 0,
            role: usersData[id].role || 'user',
            isActive: usersData[id].isActive !== undefined ? usersData[id].isActive : false,
            lastLogin: usersData[id].lastLogin || new Date(0).toISOString(),
            onlineStreak: usersData[id].onlineStreak || 0,
            avatarUrl: usersData[id].avatarUrl,
            createdAt: usersData[id].createdAt || new Date(0).toISOString(),
          }))
          .filter(user => user.role === 'admin'); // Filter for admins only
        setAllUsers(loadedUsers);
      } else {
        setAllUsers([]);
      }
      setIsLoading(false);
    }, (error: Error) => {
      console.error("AdminSubAdminsPage: Error fetching users:", error.message);
      const description = String(error.message).toUpperCase().includes("PERMISSION_DENIED")
        ? "Permission Denied. Check Firebase rules for reading /users path by admin and ensure '.indexOn': 'username' is set."
        : "Could not load users.";
      toast({ title: "Fetch Error", description, variant: "destructive" });
      setIsLoading(false);
    });
    
    return () => {
        if (database) {
            off(usersRefQuery, 'value', listener);
        }
    };
  }, [toast]);

  const displayedAdmins = useMemo(() => {
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
      });
  }, [allUsers, searchTerm, statusFilter]);


  if (isLoading && !allUsers.length) { 
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Loading admins...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Listed Admins"
        subtitle="View users with full administrative privileges."
      />

      <GlassCard className="p-0">
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
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UserStatusFilter)} >
              <SelectTrigger className="w-full sm:w-[180px] bg-input/30 border-border/50">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                <TableHead>Admin User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead className="text-center">Joined</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && displayedAdmins.length === 0 ? (
                 <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" /></TableCell></TableRow>
              ) : displayedAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    {allUsers.length === 0 ? "No admin users found." : "No admin users match your current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                displayedAdmins.map((user) => (
                  <TableRow key={user.id} className="border-b-border/20 hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-accent/30">
                          <AvatarImage src={user.avatarUrl || undefined} alt={user.username || 'Admin'} data-ai-hint="admin avatar"/>
                          <AvatarFallback>{(user.username || 'A').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{user.username}</p>
                          <p className="text-xs text-muted-foreground">ID: {user.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant='destructive'>
                        <ShieldCheckIcon className="mr-1 h-3 w-3"/> {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isActive ?
                        <BadgeCheck className="h-5 w-5 text-green-500 inline-block" title="Active" /> :
                        <BadgeX className="h-5 w-5 text-red-500 inline-block" title="Inactive" />
                      }
                    </TableCell>
                    <TableCell className="text-right text-foreground"><RupeeIcon className="inline h-3 w-auto -mt-0.5" /> {user.wallet.toFixed(2)}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent h-8 w-8" title="View Details" asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 h-8 w-8" title="Edit Admin" asChild>
                          <Link href={`/admin/users/edit/${user.id}`}>
                            <Edit3 className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
