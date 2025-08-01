
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { database } from "@/lib/firebase/config";
import { ref, get, update, push, remove, onValue, off } from 'firebase/database';
import type { GlobalSettings, ClickAndEarnLink } from '@/types';
import { useToast } from "@/hooks/use-toast";

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Save, AlertCircle, Coins, Target, Trash2, Link as LinkIcon, PlusCircle, X, MousePointerClick, Clock, Repeat as RepeatIcon, UploadCloud, Tv } from 'lucide-react';
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import PageTitle from "@/components/core/page-title";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";


const formSchema = z.object({
  enabled: z.boolean(),
  dailyTargetClicks: z.coerce.number().int().min(1, "Target must be at least 1."),
  dailyTargetReward: z.coerce.number().min(0, "Reward must be non-negative."),
  pkrPerPoint: z.coerce.number().min(0.000001, "Value must be positive."),
  
  dailyAdTaskSettings: z.object({
      stayDurationSeconds: z.coerce.number().int().min(5, "Stay duration must be at least 5 seconds."),
      linkRepeatHours: z.coerce.number().int().min(1, "Repeat interval must be at least 1 hour."),
      postRewardCooldownSeconds: z.coerce.number().int().min(0, "Cooldown must be non-negative."),
  })
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  enabled: true,
  dailyTargetClicks: 98,
  dailyTargetReward: 5,
  pkrPerPoint: 0.005,
  dailyAdTaskSettings: {
    stayDurationSeconds: 10,
    linkRepeatHours: 24,
    postRewardCooldownSeconds: 5,
  },
};

export default function AdminAdLinkSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [links, setLinks] = useState<ClickAndEarnLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  
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
        const settingsRef = ref(database, 'globalSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const settingsData = snapshot.val();
          form.reset({
            enabled: settingsData.clickAndEarnEnabled ?? defaultValues.enabled,
            dailyTargetClicks: settingsData.dailyTargetClicks ?? defaultValues.dailyTargetClicks,
            dailyTargetReward: settingsData.dailyTargetReward ?? defaultValues.dailyTargetReward,
            pkrPerPoint: settingsData.pkrPerPoint ?? defaultValues.pkrPerPoint,
            dailyAdTaskSettings: settingsData.dailyAdTaskSettings ?? defaultValues.dailyAdTaskSettings,
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchLinks = () => {
        if (!database) { setIsLoadingLinks(false); return; }
        const linksRef = ref(database, 'clickAndEarnLinks');
        const listener = onValue(linksRef, (snapshot) => {
            const data = snapshot.val();
            setLinks(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
            setIsLoadingLinks(false);
        });
        return () => off(linksRef, 'value', listener);
    }

    fetchSettings();
    const unsubscribeLinks = fetchLinks();
    
    return () => unsubscribeLinks();
  }, [form, toast]);

  const onSubmit = async (data: FormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
        const settingsToUpdate = {
            clickAndEarnEnabled: data.enabled,
            dailyTargetClicks: data.dailyTargetClicks,
            dailyTargetReward: data.dailyTargetReward,
            pkrPerPoint: data.pkrPerPoint,
            dailyAdTaskSettings: data.dailyAdTaskSettings,
        };
        await update(ref(database, 'globalSettings'), settingsToUpdate);
        
        toast({
            title: "Settings Saved",
            description: "Click & Earn settings have been updated.",
            className: "bg-green-500/20 text-green-300 border-green-500/30",
        });

    } catch (error: any) {
        toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddLink = async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
        toast({ title: "Input Error", description: "Please provide both a title and a valid URL.", variant: "destructive" });
        return;
    }
    try {
        new URL(newLinkUrl);
    } catch (_) {
        toast({ title: "Invalid URL", description: "The provided URL is not valid.", variant: "destructive" });
        return;
    }

    setIsAddingLink(true);
    try {
        await push(ref(database, 'clickAndEarnLinks'), {
            title: newLinkTitle,
            url: newLinkUrl,
            createdAt: new Date().toISOString()
        });
        toast({ title: "Link Added", description: `"${newLinkTitle}" has been added.` });
        setNewLinkTitle('');
        setNewLinkUrl('');
    } catch (error: any) {
        toast({ title: "Error", description: `Could not add link: ${error.message}`, variant: "destructive" });
    } finally {
        setIsAddingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
        await remove(ref(database, `clickAndEarnLinks/${linkId}`));
        toast({ title: "Link Deleted", description: "The link has been removed.", variant: "default" });
    } catch (error: any) {
        toast({ title: "Error", description: `Could not delete link: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handleDeleteAllLinks = async () => {
    try {
        await remove(ref(database, 'clickAndEarnLinks'));
        toast({ title: "All Links Deleted", description: "All ad links have been successfully cleared.", className: "bg-destructive/20 text-destructive-foreground" });
    } catch (error: any) {
        toast({ title: "Error", description: `Could not delete all links: ${error.message}`, variant: "destructive" });
    }
  };

  const handleAddBulkLinks = async () => {
    const urls = bulkUrls.split(/[\s,]+/).filter(url => {
        try {
            new URL(url.trim());
            return true;
        } catch (e) { return false; }
    });

    if (urls.length === 0) {
        toast({ title: "No Valid URLs", description: "Please paste at least one valid URL.", variant: "destructive" });
        return;
    }

    setIsAddingLink(true);
    try {
        const updates: Record<string, any> = {};
        urls.forEach(url => {
            const newLinkKey = push(ref(database, 'clickAndEarnLinks')).key;
            if (newLinkKey) {
                updates[newLinkKey] = {
                    title: `Ad Link ${Math.floor(1000 + Math.random() * 9000)}`,
                    url: url.trim(),
                    createdAt: new Date().toISOString()
                };
            }
        });
        await update(ref(database, 'clickAndEarnLinks'), updates);
        toast({ title: "Links Added", description: `${urls.length} new links have been added.` });
        setBulkUrls('');
    } catch (error: any) {
        toast({ title: "Error", description: `Could not add bulk links: ${error.message}`, variant: "destructive" });
    } finally {
        setIsAddingLink(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between mb-8">
           <PageTitle title="Daily Ad Task Settings" subtitle="Configure the click-based earning feature." />
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
        </div>
      
        <GlassCard>
             <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm mb-6">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium text-foreground flex items-center gap-2">
                               <MousePointerClick className="h-5 w-5 text-accent"/> Enable Ad Link Task
                            </FormLabel>
                            <p className="text-xs text-muted-foreground pl-7">Master switch for this entire feature.</p>
                        </div>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                    </FormItem>
                )}
            />

            <h3 className="text-xl font-semibold text-foreground mb-1">Task Rewards & Timings</h3>
            <p className="text-sm text-muted-foreground mb-4">Define rewards and timing rules for link clicks.</p>
            <Separator className="mb-6 bg-border/30" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="dailyTargetClicks" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground"/>Daily Clicks Target</FormLabel><Input type="number" {...field} placeholder="e.g., 98" /><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="dailyTargetReward" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground"/>Daily Target Reward (Points)</FormLabel><Input type="number" {...field} placeholder="e.g., 5" /><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="pkrPerPoint" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground"/>PKR Value per Point</FormLabel><Input type="number" step="0.000001" {...field} placeholder="e.g., 0.005" /><FormMessage/></FormItem>
                )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                 <FormField control={form.control} name="dailyAdTaskSettings.stayDurationSeconds" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground"/>Required Stay (Seconds)</FormLabel><Input type="number" {...field} placeholder="e.g., 10" /><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="dailyAdTaskSettings.linkRepeatHours" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><RepeatIcon className="h-4 w-4 text-muted-foreground"/>Link Repeat (Hours)</FormLabel><Input type="number" {...field} placeholder="e.g., 24" /><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="dailyAdTaskSettings.postRewardCooldownSeconds" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground"/>Next Task Cooldown (Seconds)</FormLabel><Input type="number" {...field} placeholder="e.g., 5" /><FormMessage /></FormItem>
                )}/>
            </div>
       </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GlassCard>
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2"><PlusCircle className="h-5 w-5 text-accent"/>Add New Ad Link</h3>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="new-link-title">Link Title</Label>
                        <Input id="new-link-title" placeholder="e.g., Ad Provider A - Video" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="new-link-url">Link URL</Label>
                        <Input id="new-link-url" placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                    </div>
                    <Button onClick={handleAddLink} disabled={isAddingLink} className="w-full">
                        {isAddingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Link
                    </Button>
                </div>
                 <Separator className="my-6"/>
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2"><UploadCloud className="h-5 w-5 text-accent"/>Bulk Add Links</h3>
                <div className="space-y-2">
                    <Label htmlFor="bulk-urls">Paste Multiple URLs</Label>
                    <Textarea id="bulk-urls" placeholder="Paste URLs here, separated by new lines, spaces, or commas." value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} className="h-24 bg-input/50"/>
                    <Button type="button" onClick={handleAddBulkLinks} className="w-full" disabled={isAddingLink}><UploadCloud className="mr-2"/> Add Links to List</Button>
                </div>
            </GlassCard>
            <GlassCard className="p-0 flex flex-col">
                <div className="p-4 border-b border-border/30 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Existing Links ({links.length})</h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={links.length === 0}><Trash2 className="mr-2 h-4 w-4"/> Delete All</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card">
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete all {links.length} ad links permanently.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAllLinks}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
                 <ScrollArea className="h-96">
                    {isLoadingLinks ? <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div> :
                     links.length === 0 ? <p className="text-center text-muted-foreground py-10">No links added yet.</p> :
                        <ul className="divide-y divide-border/30">
                            {links.map(link => (
                                <li key={link.id} className="p-3 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground truncate max-w-xs">{link.title}</p>
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block max-w-xs">{link.url}</a>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleDeleteLink(link.id)}><Trash2 className="h-4 w-4"/></Button>
                                </li>
                            ))}
                        </ul>
                    }
                 </ScrollArea>
            </GlassCard>
        </div>
        
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
