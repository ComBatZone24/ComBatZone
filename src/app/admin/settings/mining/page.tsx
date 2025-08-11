
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, onValue, off } from 'firebase/database';
import type { CpuMiningSettings, User as AppUserType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Save, Cpu, Percent, Users, Coins } from 'lucide-react';
import PageTitle from '@/components/core/page-title';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  enabled: z.boolean(),
  throttle: z.coerce.number().min(0, "Throttle must be between 0 and 99").max(99, "Throttle must be between 0 and 99"),
  coinsPer1MHashes: z.coerce.number().min(0, "Coins reward must be a non-negative number."),
  cardTitle: z.string().min(3, "Title is required."),
  cardDescription: z.string().min(10, "Description is required."),
  viewStatsButtonText: z.string().min(3, "Button text is required."),
  dialogTitle: z.string().min(3, "Title is required."),
  dialogDescription: z.string().min(10, "Description is required."),
  coinsEarnedLabel: z.string().min(3, "Label is required."),
  startMiningButtonText: z.string().min(3, "Button text is required."),
  stopMiningButtonText: z.string().min(3, "Button text is required."),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  enabled: true,
  throttle: 80,
  coinsPer1MHashes: 10,
  cardTitle: "CPU Mining (MINTME)",
  cardDescription: "Use your device's spare processing power to earn MINTME coins. Ideal for when your device is idle or charging.",
  viewStatsButtonText: "View Stats",
  dialogTitle: "CPU Mining",
  dialogDescription: "Start Earning MINTME",
  coinsEarnedLabel: "Coins Earned",
  startMiningButtonText: "Start Mining",
  stopMiningButtonText: "Stop Mining",
};

export default function AdminCpuMiningSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<AppUserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const { control, watch } = form;
  const throttleValue = watch('throttle');
  const usageValue = 100 - throttleValue;

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        setIsLoading(false);
        form.reset(defaultValues);
        return;
      }
      try {
        const settingsRef = ref(database, 'globalSettings/cpuMiningSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          form.reset({ ...defaultValues, ...snapshot.val() });
        } else {
          form.reset(defaultValues);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [form, toast]);

  useEffect(() => {
    if (!database) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
        const usersData: AppUserType[] = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                usersData.push({ id: child.key!, ...child.val() });
            });
        }
        setAllUsers(usersData.filter(u => u.cpuMiningEarnedCoins && u.cpuMiningEarnedCoins > 0).sort((a,b) => (b.cpuMiningEarnedCoins || 0) - (a.cpuMiningEarnedCoins || 0)));
        setIsLoadingUsers(false);
    });
    return () => unsubscribe();
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
        await update(ref(database, 'globalSettings/cpuMiningSettings'), data);
        
        toast({
            title: "Settings Saved",
            description: "CPU Mining settings have been updated.",
            className: "bg-green-500/20 text-green-300 border-green-500/30",
        });

    } catch (error: any) {
        toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between mb-8">
           <PageTitle title="CPU Mining Settings" subtitle="Configure the CPU mining feature for users." />
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
        </div>
      
        <GlassCard>
            <div className="space-y-6 p-6">
                <FormField
                    control={control} name="enabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                            <div className="space-y-0.5"><FormLabel className="text-base font-medium text-foreground">Enable CPU Mining</FormLabel><p className="text-xs text-muted-foreground">Master switch for the entire feature.</p></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />

                <Controller
                    control={control} name="throttle"
                    render={({ field }) => (
                        <div className="space-y-3 pt-2">
                            <Label htmlFor="throttle-slider" className="text-md font-medium">CPU Usage Limit: <span className="font-bold text-accent">{usageValue}%</span></Label>
                            <p className="text-xs text-muted-foreground">Set the maximum CPU power the miner can use. Lower usage is better for user devices.</p>
                            <Slider id="throttle-slider" min={1} max={99} step={1} value={[100 - field.value]} onValueChange={(vals) => field.onChange(100 - vals[0])} />
                             <p className="text-xs text-muted-foreground">(Throttle is set to {field.value}%. A throttle of 80% means 20% CPU usage.)</p>
                        </div>
                    )}
                />

                <FormField
                    control={control} name="coinsPer1MHashes"
                    render={({ field }) => (
                        <FormItem><FormLabel>Coins per 1 Million Hashes</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
            </div>
       </GlassCard>

       <GlassCard>
            <div className="p-6 space-y-6">
                <h4 className="font-semibold text-lg text-foreground">UI Text Configuration</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <FormField control={control} name="cardTitle" render={({ field }) => (<FormItem><FormLabel>Card Title (Earn Tasks Page)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                     <FormField control={control} name="viewStatsButtonText" render={({ field }) => (<FormItem><FormLabel>View Stats Button Text</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                 </div>
                 <FormField control={control} name="cardDescription" render={({ field }) => (<FormItem><FormLabel>Card Description</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />

                <h4 className="font-semibold text-lg text-foreground pt-4 border-t border-border/30">Dialog Text Configuration</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="dialogTitle" render={({ field }) => (<FormItem><FormLabel>Dialog Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={control} name="dialogDescription" render={({ field }) => (<FormItem><FormLabel>Dialog Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={control} name="coinsEarnedLabel" render={({ field }) => (<FormItem><FormLabel>Coins Earned Label</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="startMiningButtonText" render={({ field }) => (<FormItem><FormLabel>Start Button Text</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={control} name="stopMiningButtonText" render={({ field }) => (<FormItem><FormLabel>Stop Button Text</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
            </div>
       </GlassCard>
        
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSaving || isLoading} className="neon-accent-bg">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4"/>}
            Save Settings
        </Button>
        </div>
      </form>
        <Separator className="my-8" />
        <GlassCard>
            <div className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Users className="text-accent" /> User Earnings Report
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Total MINTME coins earned by users through CPU mining.</p>
                <div className="max-h-96 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead className="text-right">Total Coins Earned</TableHead>
                                <TableHead>Last Login</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingUsers ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="animate-spin" /></TableCell></TableRow>
                            ) : allUsers.length > 0 ? (
                                allUsers.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border-2 border-primary/20"><AvatarImage src={user.avatarUrl || undefined} /><AvatarFallback>{user.username.charAt(0)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="font-semibold">{user.username}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-accent">{(user.cpuMiningEarnedCoins || 0).toFixed(6)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{user.lastLogin ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true }) : 'N/A'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No users have earned mining rewards yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </GlassCard>
    </Form>
  );
}
