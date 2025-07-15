
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '@/lib/firebase/config';
import { ref, get, update } from 'firebase/database';
import type { GlobalSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Save, Gift, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const dailyRewardsSchema = z.object({
  enabled: z.boolean(),
  rewards: z.array(z.coerce.number().min(0, "Reward must be non-negative."))
    .length(7, "There must be exactly 7 daily rewards."),
});

type DailyRewardsFormValues = z.infer<typeof dailyRewardsSchema>;

const defaultValues: DailyRewardsFormValues = {
  enabled: true,
  rewards: [10, 15, 20, 25, 30, 35, 100], // Default rewards for 7 days
};

export default function AdminDailyRewardsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<DailyRewardsFormValues>({
    resolver: zodResolver(dailyRewardsSchema),
    defaultValues: defaultValues,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const settingsRef = ref(database, 'globalSettings/dailyLoginRewards');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const settingsData = snapshot.val();
          // Ensure rewards is an array of 7 items
          const rewardsArray = Array.isArray(settingsData.rewards) && settingsData.rewards.length === 7 
            ? settingsData.rewards 
            : defaultValues.rewards;
          form.reset({
            enabled: settingsData.enabled ?? defaultValues.enabled,
            rewards: rewardsArray,
          });
        }
      } catch (error) {
        console.error("Error fetching daily reward settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [toast, form]);

  const onSubmit = async (data: DailyRewardsFormValues) => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Cannot save settings.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsToUpdate = {
        enabled: data.enabled,
        rewards: data.rewards,
      };
      await update(ref(database, 'globalSettings/dailyLoginRewards'), settingsToUpdate);
      toast({
        title: "Settings Saved",
        description: "Daily login reward settings have been updated.",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Gift className="mr-3 h-8 w-8 text-accent" /> Daily Login Rewards
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <GlassCard>
            <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30 mb-6">
                <Label htmlFor="enabled" className="text-md font-medium text-foreground cursor-pointer">
                    Enable Daily Login Reward System
                </Label>
                <Controller
                    name="enabled"
                    control={form.control}
                    render={({ field }) => (
                        <Switch
                            id="enabled"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-accent"
                        />
                    )}
                />
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-1">Reward Amounts</h3>
            <p className="text-sm text-muted-foreground mb-4">Set the PKR reward for each consecutive day of logging in.</p>
            <Separator className="mb-6 bg-border/30" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {form.getValues('rewards').map((_, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`reward-day-${index + 1}`}>Day {index + 1} {index === 6 && '(Bonus)'}</Label>
                   <Controller
                    name={`rewards.${index}`}
                    control={form.control}
                    render={({ field }) => (
                        <Input
                            id={`reward-day-${index + 1}`}
                            type="number"
                            placeholder="e.g., 20"
                            className="bg-input/50 border-border/70 focus:border-accent"
                            {...field}
                        />
                    )}
                  />
                </div>
              ))}
            </div>
             {form.formState.errors.rewards && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.rewards.message || form.formState.errors.rewards.root?.message}</p>
             )}
          </GlassCard>
          
          <Alert variant="default" className="bg-primary/10 border-primary/30">
            <AlertCircle className="h-5 w-5 !text-primary" />
            <AlertTitle className="!text-primary">How it Works</AlertTitle>
            <AlertDescription className="!text-primary/80">
              Users will see a popup once per day to claim their reward. If a user misses a day, their streak will reset to Day 1. Day 7 is the special weekly bonus.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="neon-accent-bg" disabled={isSaving}>
              <Save className="mr-2 h-5 w-5" /> {isSaving ? 'Saving...' : 'Save Reward Settings'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
