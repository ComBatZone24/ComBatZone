
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { database } from '@/lib/firebase/config';
import { ref, get, update } from 'firebase/database';
import type { GlobalSettings, AdsterraSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Loader2, Save, DollarSign, AlertCircle, PlusCircle, Trash2, Link as LinkIcon, Clock, MousePointerClick, Navigation } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const adsterraSettingsFormSchema = z.object({
  enabled: z.boolean(),
  directLinks: z.array(z.object({
    url: z.string(), // Relaxed validation: any string is fine for input
  })).min(1, "You must have at least one link field."),
  popupsEnabled: z.boolean(),
  popupMinInterval: z.coerce.number().min(1, "Minimum interval must be at least 1 minute."),
  popupMaxInterval: z.coerce.number().min(1, "Maximum interval must be at least 1 minute."),
  buttonAdPlacements: z.record(z.string(), z.boolean()).optional(),
}).refine(data => !data.popupsEnabled || (data.popupMinInterval <= data.popupMaxInterval), {
  message: "Minimum interval cannot be greater than the maximum interval.",
  path: ['popupMinInterval'],
});

type AdsterraSettingsFormValues = z.infer<typeof adsterraSettingsFormSchema>;

const availableButtonPlacements = [
    { id: 'tournament_join_now', label: 'Tournament "Join Now" Button', group: 'Actions' },
    { id: 'wallet_withdraw', label: 'Wallet "Withdraw Funds" Button', group: 'Actions' },
    { id: 'spin_wheel_spin', label: 'Spin the Wheel "Spin" Button', group: 'Actions' },
    { id: 'duel_find_match', label: 'Duels "Find Match" Button', group: 'Actions' },
    
    // Navigation Links
    { id: 'nav_tournaments', label: 'Bottom Nav: Tournaments', group: 'Navigation' },
    { id: 'nav_shop', label: 'Bottom Nav: Shop', group: 'Navigation' },
    { id: 'nav_earn-tasks', label: 'Bottom Nav: Earn Tasks', group: 'Navigation' },
    { id: 'nav_wallet', label: 'Bottom Nav: Wallet', group: 'Navigation' },
    { id: 'nav_profile', label: 'Bottom Nav: Profile', group: 'Navigation' },
];

const defaultValues: AdsterraSettingsFormValues = {
  enabled: false,
  directLinks: [{ url: '' }],
  popupsEnabled: false,
  popupMinInterval: 3,
  popupMaxInterval: 7,
  buttonAdPlacements: {},
};

export default function AdminAdsterraSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AdsterraSettingsFormValues>({
    resolver: zodResolver(adsterraSettingsFormSchema),
    defaultValues: defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "directLinks",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        setIsLoading(false);
        return;
      }
      try {
        const settingsRef = ref(database, 'globalSettings/adsterraSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const settingsData: AdsterraSettings = snapshot.val();
          const formLinks = (settingsData.directLinks && Array.isArray(settingsData.directLinks))
            ? settingsData.directLinks.map(url => ({ url }))
            : [];
          
          if (formLinks.length === 0) {
            formLinks.push({ url: '' });
          }
          
          form.reset({ ...defaultValues, ...settingsData, directLinks: formLinks });
        }
      } catch (error) {
        console.error("Error fetching Adsterra settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  const onSubmit = async (data: AdsterraSettingsFormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
        const validLinks: string[] = [];
        const invalidLinks: string[] = [];
        
        data.directLinks.forEach(linkObj => {
            const url = linkObj.url.trim();
            if (url === '') return;
            
            try {
                // This will throw an error for malformed URLs like "example.com" without a protocol
                new URL(url); 
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    validLinks.push(url);
                } else {
                    invalidLinks.push(url);
                }
            } catch (e) {
                invalidLinks.push(url);
            }
        });

        if (invalidLinks.length > 0) {
            toast({
                title: "Invalid URL Format",
                description: `Links must be valid and start with http:// or https://. Invalid link found: "${invalidLinks[0]}"`,
                variant: "destructive"
            });
            setIsSaving(false);
            return;
        }

        if (data.enabled && validLinks.length === 0) {
            toast({
                title: "Validation Error",
                description: "You must provide at least one valid ad link when the system is enabled.",
                variant: "destructive"
            });
            setIsSaving(false);
            return;
        }

        const settingsToSave: AdsterraSettings = {
            ...data,
            directLinks: validLinks,
        };

        await update(ref(database, 'globalSettings/adsterraSettings'), settingsToSave);
        
        toast({
            title: "Settings Saved",
            description: "Adsterra monetization settings have been updated.",
            className: "bg-green-500/20 text-green-300 border-green-500/30",
            duration: 5000,
        });

    } catch (error: any) {
        toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const groupedPlacements = availableButtonPlacements.reduce((acc, placement) => {
    const group = placement.group || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(placement);
    return acc;
  }, {} as Record<string, typeof availableButtonPlacements>);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <DollarSign className="mr-3 h-8 w-8 text-accent" /> Ad Monetization
          </h1>
          <Button variant="outline" asChild>
            <Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
          </Button>
        </div>

        <GlassCard>
            <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-x-3 rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium text-foreground">Enable Adsterra System</FormLabel>
                            <p className="text-xs text-muted-foreground">Master switch to enable or disable all Adsterra ads.</p>
                        </div>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                    </FormItem>
                )}
            />
        </GlassCard>

        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Direct Links for Ads</h3>
            <p className="text-sm text-muted-foreground mb-4">Add Adsterra direct links that will be used for popups and button ads.</p>
            <Separator className="mb-6 bg-border/30" />
            <div className="space-y-4">
                 {fields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`directLinks.${index}.url`}
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                     <LinkIcon className="h-4 w-4 text-muted-foreground"/>
                                     <FormControl>
                                        <Input {...field} placeholder="https://..."/>
                                     </FormControl>
                                     <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                        <Trash2 className="h-4 w-4"/>
                                     </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ url: ''})}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Another Link
                 </Button>
            </div>
        </GlassCard>
        
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Button Ad Placements</h3>
            <p className="text-sm text-muted-foreground mb-4">Choose which buttons in the app will trigger an ad when clicked.</p>
            <Separator className="mb-6 bg-border/30" />
            <div className="space-y-6">
                {Object.entries(groupedPlacements).map(([groupName, placements]) => (
                    <div key={groupName}>
                        <h4 className="text-md font-semibold text-accent mb-3 flex items-center gap-2">
                           {groupName === 'Actions' ? <MousePointerClick className="h-5 w-5"/> : <Navigation className="h-5 w-5"/>}
                           {groupName}
                        </h4>
                        <div className="space-y-3">
                            {placements.map((placement) => (
                                <FormField
                                    key={placement.id}
                                    control={form.control}
                                    name={`buttonAdPlacements.${placement.id}`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-sm font-medium text-foreground">{placement.label}</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>


        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Random Popup Ads</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure automatic full-screen ad popups.</p>
            <Separator className="mb-6 bg-border/30" />
            <FormField
                control={form.control}
                name="popupsEnabled"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium text-foreground">Enable Popup Ads</FormLabel>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )}
            />
            {form.watch('popupsEnabled') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                        control={form.control}
                        name="popupMinInterval"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/> Min Interval (minutes)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="popupMaxInterval"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4"/> Max Interval (minutes)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                </div>
            )}
        </GlassCard>

        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Important</AlertTitle>
          <AlertDescription className="!text-primary/80">
            Excessive or aggressive ads can lead to a poor user experience and may be against platform policies. Use these features responsibly.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSaving} className="neon-accent-bg">
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
            Save Ad Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
