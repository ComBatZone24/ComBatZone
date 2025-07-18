

"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { database } from "@/lib/firebase/config";
import { ref, get, update, push, remove, serverTimestamp, onValue, off } from 'firebase/database';
import type { GlobalSettings, ClickMilestone, ClickAndEarnLink } from '@/types';
import { useToast } from "@/hooks/use-toast";

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Save, AlertCircle, Coins, Target, Trash2, Link as LinkIcon } from 'lucide-react';
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const FIXED_DAILY_TARGET = 98;

const formSchema = z.object({
    pkrPerPoint: z.coerce.number().min(0.000001, "Value must be positive."),
    dailyTargetReward: z.coerce.number().min(0, "Reward must be non-negative."),
});

type ClickAndEarnFormValues = z.infer<typeof formSchema>;

const defaultValues: ClickAndEarnFormValues = {
  pkrPerPoint: 0.99,
  dailyTargetReward: 35,
};

export default function AdminClickAndEarnSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [links, setLinks] = useState<ClickAndEarnLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkTitle, setLinkTitle] = useState("Ad Task - joanordeal.com");
  const [linkUrl, setLinkUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [isAddingBulk, setIsAddingBulk] = useState(false);

  const form = useForm<ClickAndEarnFormValues>({
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
          const settingsData: Partial<GlobalSettings> = snapshot.val();
          const targetMilestone = settingsData.clickMilestones?.find(m => m.clicks === FIXED_DAILY_TARGET);

          form.reset({
            pkrPerPoint: settingsData.pkrPerPoint ?? defaultValues.pkrPerPoint,
            dailyTargetReward: targetMilestone?.points ?? defaultValues.dailyTargetReward,
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
        const linksRef = ref(database, 'clickAndEarnLinks');
        const listener = onValue(linksRef, (snapshot) => {
            const data = snapshot.val();
            const loadedLinks = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
            setLinks(loadedLinks.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)));
            setIsLoadingLinks(false);
        });
        return listener;
    };
    
    fetchSettings();
    const linksListener = fetchLinks();
    
    return () => {
        if(database) off(ref(database, 'clickAndEarnLinks'), 'value', linksListener);
    }
  }, [form, toast]);

  const onSubmit = async (data: ClickAndEarnFormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
        const settingsToUpdate: Partial<GlobalSettings> = {
            pkrPerPoint: data.pkrPerPoint,
            clickMilestones: [
                { clicks: FIXED_DAILY_TARGET, points: data.dailyTargetReward }
            ],
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
    if (!linkUrl.trim()) {
      toast({ title: "Input Error", description: "Please provide a URL.", variant: "destructive" });
      return;
    }
    setIsAddingLink(true);
    try {
      await push(ref(database, 'clickAndEarnLinks'), {
        title: linkTitle,
        url: linkUrl,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Success", description: "New link added." });
      setLinkUrl('');
    } catch (error) {
      console.error("Error adding link:", error);
      toast({ title: "Error", description: "Could not add link.", variant: "destructive" });
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleAddBulkLinks = async () => {
    const urls = bulkUrls.split(/[\s,]+/).filter(url => url.trim() !== '');
    if (urls.length === 0) {
      toast({ title: "Input Error", description: "Please paste at least one URL.", variant: "destructive" });
      return;
    }
    setIsAddingBulk(true);
    try {
      const updates: Record<string, any> = {};
      urls.forEach(url => {
        const newLinkKey = push(ref(database, 'clickAndEarnLinks')).key;
        if(newLinkKey) {
            updates[newLinkKey] = {
                title: "Ad Task - joanordeal.com",
                url: url.trim(),
                createdAt: serverTimestamp(),
            };
        }
      });
      await update(ref(database, 'clickAndEarnLinks'), updates);
      toast({ title: "Success", description: `${urls.length} links have been added.` });
      setBulkUrls('');
    } catch (error) {
      console.error("Error adding bulk links:", error);
      toast({ title: "Error", description: "Could not add bulk links.", variant: "destructive" });
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    await remove(ref(database, `clickAndEarnLinks/${id}`));
  };

  const handleDeleteAllLinks = async () => {
    await remove(ref(database, 'clickAndEarnLinks'));
    toast({ title: "All links deleted", description: "The Click & Earn link list has been cleared." });
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between mb-8">
           <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Target className="mr-3 h-8 w-8 text-accent" /> Click &amp; Earn Settings
          </h1>
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
        </div>
      
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-4">Daily Target & Reward</h3>
            <p className="text-sm text-muted-foreground mb-4">Define the reward for completing the daily click target of {FIXED_DAILY_TARGET} clicks.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="dailyTargetReward"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Daily Target ({FIXED_DAILY_TARGET} Clicks) Reward</FormLabel>
                            <Input type="number" {...field} placeholder="e.g., 35" />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="pkrPerPoint"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground"/> Value of 1 Point (in PKR)</FormLabel>
                            <Input type="number" step="any" {...field} placeholder="e.g., 0.99" />
                            <FormMessage/>
                        </FormItem>
                    )}
                />
            </div>
       </GlassCard>
        
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-4">Manage Ad Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Add New Link (Manual)</h4>
                     <div className="space-y-1"><Label htmlFor="linkTitle">Task Title</Label><Input id="linkTitle" value={linkTitle} onChange={e => setLinkTitle(e.target.value)}/></div>
                     <div className="space-y-1"><Label htmlFor="linkUrl">Ad Link URL</Label><Input id="linkUrl" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}/></div>
                     <Button onClick={handleAddLink} disabled={isAddingLink} className="w-full">{isAddingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Link</Button>
                </div>
                 <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Bulk Paste Links</h4>
                    <p className="text-xs text-muted-foreground">Paste a list of URLs (one per line or separated by spaces) to add multiple links at once.</p>
                     <Textarea placeholder="Paste Links Here" value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} className="h-28"/>
                     <Button onClick={handleAddBulkLinks} disabled={isAddingBulk} className="w-full">{isAddingBulk && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Pasted Links</Button>
                </div>
            </div>
        </GlassCard>
        
        <GlassCard className="p-0">
             <div className="p-4 border-b border-border/30 flex justify-between items-center">
                 <h3 className="text-lg font-semibold">Existing Links ({links.length})</h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={links.length === 0}><Trash2 className="mr-2 h-4 w-4"/> Delete All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card">
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete all {links.length} links permanently. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAllLinks}>Delete All</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
            <ScrollArea className="h-96">
                <div className="p-4 space-y-2">
                    {isLoadingLinks ? <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6"/></div> :
                        links.length === 0 ? <p className="text-center text-muted-foreground py-4">No links added yet.</p> :
                        links.map(link => (
                            <div key={link.id} className="flex items-center gap-2 p-2 bg-muted/20 rounded-md">
                                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                                <p className="text-sm text-foreground flex-grow truncate" title={link.url}>{link.title || 'Untitled Task'}</p>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLink(link.id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))
                    }
                </div>
            </ScrollArea>
        </GlassCard>

        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" /><AlertTitle className="!text-primary">How It Works</AlertTitle><AlertDescription className="!text-primary/80">Every user will now have a daily target of {FIXED_DAILY_TARGET} clicks. Upon completing this target, they will be awarded the points you set above. Users can convert their accumulated points to PKR at any time using the conversion rate specified.</AlertDescription>
        </Alert>

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
