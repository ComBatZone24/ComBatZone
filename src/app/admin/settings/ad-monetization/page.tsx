

"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { database } from "@/lib/firebase/config";
import { ref, get, update } from 'firebase/database';
import type { AdsterraSettings } from '@/types';
import { useToast } from "@/hooks/use-toast";

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Save, Link as LinkIcon, Coins } from 'lucide-react';
import Link from "next/link";
import PageTitle from "@/components/core/page-title";
import { Switch } from "@/components/ui/switch";


const formSchema = z.object({
  enabled: z.boolean(),
  pointsPerView: z.coerce.number().min(0, "Reward must be non-negative."),
  adsterraDirectLink: z.string().url("Must be a valid URL.").or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  enabled: true,
  pointsPerView: 5,
  adsterraDirectLink: "",
};

export default function AdminAdMonetizationSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        setIsLoading(false);
        form.reset(defaultValues);
        return;
      }
      try {
        const settingsRef = ref(database, 'globalSettings/adsterraSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const settingsData = snapshot.val();
          form.reset({
            enabled: settingsData.enabled ?? defaultValues.enabled,
            pointsPerView: settingsData.pointsPerView ?? defaultValues.pointsPerView,
            adsterraDirectLink: settingsData.adsterraDirectLink ?? defaultValues.adsterraDirectLink,
          });
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

  const onSubmit = async (data: FormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
        const settingsToUpdate = {
            enabled: data.enabled,
            pointsPerView: data.pointsPerView,
            adsterraDirectLink: data.adsterraDirectLink,
        };
        await update(ref(database, 'globalSettings/adsterraSettings'), settingsToUpdate);
        
        toast({
            title: "Settings Saved",
            description: "Ad Monetization settings have been updated.",
            className: "bg-green-500/20 text-green-300 border-green-500/30",
        });

    } catch (error: any) {
        toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between mb-8">
           <PageTitle title="Adsterra Ad Link Settings" subtitle="Configure Adsterra direct links and rewards." />
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
        </div>
      
        <GlassCard>
             <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm mb-6">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium text-foreground">Enable Adsterra Task</FormLabel>
                            <p className="text-xs text-muted-foreground">Master switch for this feature.</p>
                        </div>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                    </FormItem>
                )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="pointsPerView" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground"/>Points per Click</FormLabel><Input type="number" {...field} placeholder="e.g., 5" /><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="adsterraDirectLink" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-muted-foreground"/>Adsterra Direct Link</FormLabel><Input {...field} placeholder="e.g., https://..." /><FormMessage/></FormItem>
                )}/>
            </div>
       </GlassCard>
        
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSaving || isLoading} className="neon-accent-bg">
            {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4"/>}
            Save Settings
        </Button>
        </div>
      </form>
    </Form>
  );
}
