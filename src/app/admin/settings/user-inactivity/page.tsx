
// src/app/admin/settings/inactivity-policy/page.tsx - Renamed and refactored
"use client";

import { useEffect, useState, useMemo } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '@/lib/firebase/config';
import type { PlatformAppSettings, User, InactivityPolicy } from '@/types/index';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Switch } from '@/components/ui/switch';
import GlassCard from '@/components/core/glass-card';
import Link from 'next/link';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { UserCog, Users, Save, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import RupeeIcon from '@/components/core/rupee-icon';
import { Alert, AlertTitle } from '@/components/ui/alert';

// Define the form schema according to the nested structure
const formSchema = z.object({
  inactivityPolicy: z.object({
    daysInactive: z.coerce.number().min(1, 'Days inactive must be at least 1'),
    holdPeriod: z.coerce.number().min(0, 'Hold period cannot be negative'),
    finalDeleteAfter: z.coerce.number().min(0, 'Final delete after cannot be negative'),
  }),
  autoNotifyOnActiveUser: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const defaultSettings: FormValues = {
  inactivityPolicy: {
    daysInactive: 30,
    holdPeriod: 15,
    finalDeleteAfter: 90,
  },
  autoNotifyOnActiveUser: true,
};

export default function UserInactivityPolicyPage() {
  const [settings, setSettings] = useState<FormValues>(defaultSettings);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultSettings,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setLoadingSettings(false);
        form.reset(defaultSettings);
        return;
      }
      setLoadingSettings(true);
      try {
        const settingsRef = ref(database, 'settings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const fetchedData = snapshot.val() as Partial<PlatformAppSettings>;
          const currentSettings: FormValues = {
            inactivityPolicy: {
              daysInactive: fetchedData.inactivityPolicy?.daysInactive ?? defaultSettings.inactivityPolicy.daysInactive,
              holdPeriod: fetchedData.inactivityPolicy?.holdPeriod ?? defaultSettings.inactivityPolicy.holdPeriod,
              finalDeleteAfter: fetchedData.inactivityPolicy?.finalDeleteAfter ?? defaultSettings.inactivityPolicy.finalDeleteAfter,
            },
            autoNotifyOnActiveUser: fetchedData.autoNotifyOnActiveUser ?? defaultSettings.autoNotifyOnActiveUser,
          };
          setSettings(currentSettings);
          form.reset(currentSettings);
        } else {
          form.reset(defaultSettings);
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast({ title: 'Error', description: 'Failed to fetch inactivity policy settings.', variant: 'destructive' });
        form.reset(defaultSettings);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!database) {
        setLoadingUsers(false);
        return;
      }
      setLoadingUsers(true);
      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const userList: User[] = Object.keys(usersData).map((key) => ({
            id: key,
            ...usersData[key],
          }));
          setAllUsers(userList);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({ title: 'Error', description: 'Failed to fetch users.', variant: 'destructive' });
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [toast]);

  const inactiveUsers = useMemo(() => {
    return allUsers.filter((user) => {
      if (!settings.inactivityPolicy.daysInactive) return false;
      if (!user.lastLogin) return true; // Consider users with no last login as inactive

      try {
        const lastLoginDate = new Date(user.lastLogin);
        if (isNaN(lastLoginDate.getTime())) return true; // Invalid date, treat as inactive

        const daysSinceLastLogin = Math.floor(
          (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceLastLogin >= settings.inactivityPolicy.daysInactive;
      } catch (e) {
        return true; // Error parsing date, treat as inactive
      }
    });
  }, [allUsers, settings.inactivityPolicy.daysInactive]);

  async function onSubmit(values: FormValues) {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsRef = ref(database, 'settings');
      const settingsToUpdate: Partial<PlatformAppSettings> = {
        inactivityPolicy: values.inactivityPolicy,
        autoNotifyOnActiveUser: values.autoNotifyOnActiveUser,
        updatedAt: new Date().toISOString(), // Using client-side timestamp for simplicity
      };
      await update(settingsRef, settingsToUpdate); // Use update to avoid overwriting other settings
      setSettings(values); // Update local state to reflect saved settings
      toast({ title: 'Success', description: 'Inactivity policy settings saved.', className: 'bg-green-500/20 text-green-300 border-green-500/30' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  if (loadingSettings || (loadingUsers && allUsers.length === 0)) { // Adjusted loading condition
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <UserCog className="mr-3 h-8 w-8 text-accent" /> User Inactivity Policy
          </h1>
        </div>
        <GlassCard>
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-64 w-full" />
        </GlassCard>
        <GlassCard>
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-40 w-full" />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <UserCog className="mr-3 h-8 w-8 text-accent" /> User Inactivity Policy
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-1">Policy Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">Define when users are marked as inactive and related parameters.</p>
        <Separator className="mb-6 bg-border/30" />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="inactivityPolicy.daysInactive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Days to Mark as Inactive</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-input/50 border-border/70 focus:border-accent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="inactivityPolicy.holdPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Hold Period (Days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-input/50 border-border/70 focus:border-accent" />
                    </FormControl>
                    <FormDescription className="text-xs">After being marked inactive, how long to wait before further action (e.g., deletion).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="inactivityPolicy.finalDeleteAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Days Until Final Deletion</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-input/50 border-border/70 focus:border-accent" />
                    </FormControl>
                    <FormDescription className="text-xs">Total days from last login until account is eligible for deletion.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="autoNotifyOnActiveUser" // This field should exist in your form schema
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between space-x-3 rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium text-foreground">
                      Notify Admins of Newly Inactive Users
                    </FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      Enable to trigger a (backend) notification when users become inactive.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-accent"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end pt-2">
              <Button type="submit" className="neon-accent-bg" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Policy'}
              </Button>
            </div>
          </form>
        </Form>
      </GlassCard>

       <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Backend Process Note</AlertTitle>
          <div className="!text-primary/80 text-sm">
             Actually marking users as inactive, notifying, or deleting accounts based on these settings requires a separate backend process or scheduled function. This page only configures the policy.
          </div>
        </Alert>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-1 flex items-center">
          <Users className="mr-2 h-5 w-5 text-accent" /> Currently Inactive Users ({inactiveUsers.length})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Users considered inactive based on the current "Days to Mark as Inactive" setting ({settings.inactivityPolicy.daysInactive} days).
          <span className="block text-xs mt-1">Note: This list is based on client-side filtering of all users and may be slow with many users. For production, a backend solution is recommended.</span>
        </p>
        <Separator className="mb-6 bg-border/30" />
        {loadingUsers ? (
          <div className="flex justify-center items-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-2 text-muted-foreground">Loading user data...</p>
          </div>
        ) : inactiveUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No users currently meet the inactivity criteria based on {settings.inactivityPolicy.daysInactive} days.</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {inactiveUsers.map((user) => (
              <li
                key={user.id}
                className="border border-border/30 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center bg-background/40 hover:bg-muted/20"
              >
                <div className="flex-grow mb-2 sm:mb-0">
                  <p className="font-semibold text-foreground">{user.username || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last Login: <span className="text-foreground">{user.lastLogin ? format(new Date(user.lastLogin), 'PPpp') : 'Never'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Wallet: <RupeeIcon className="inline h-3" /> <span className="text-foreground">{user.wallet?.toFixed(2) || '0.00'}</span></p>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link href={`/admin/users/${user.id}`}>View Profile</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

