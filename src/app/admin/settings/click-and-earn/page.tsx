
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@/lib/firebase/config";
import { ref, onValue, off, set, serverTimestamp, update, get, remove } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import GlassCard from "@/components/core/glass-card";
import PageTitle from "@/components/core/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlusCircle, Trash2, Save, Link as LinkIcon, AlertCircle, Coins, ArrowLeft, Upload, Target } from "lucide-react";
import type { ClickAndEarnLink, GlobalSettings } from "@/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDescriptionDelete,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const linkSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  url: z.string().url("Please enter a valid URL."),
  reward: z.coerce.number().min(0.001, "Reward must be a positive number."),
});

type LinkFormValues = z.infer<typeof linkSchema>;

interface PageSettings {
    pointsToCurrencyRate: number;
    currencyPerRate: number;
    clickAndEarnTitle: string;
    clickAndEarnDescription: string;
    dailyPointsLimit: number;
}

export default function AdminClickAndEarnSettingsPage() {
  const [links, setLinks] = useState<ClickAndEarnLink[]>([]);
  const [pageSettings, setPageSettings] = useState<PageSettings>({ 
      pointsToCurrencyRate: 50, 
      currencyPerRate: 49.5,
      clickAndEarnTitle: 'Want higher rewards?',
      clickAndEarnDescription: 'Use a VPN from USA, Canada, UK, Australia, or Germany and earn extra points by watching ads.',
      dailyPointsLimit: 100, // Default daily limit
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [bulkLinksText, setBulkLinksText] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeletingUntitled, setIsDeletingUntitled] = useState(false);


  useEffect(() => {
    if (!database) return;
    const linksRef = ref(database, 'clickAndEarnLinks');
    const settingsRef = ref(database, 'globalSettings');
    
    const linksUnsubscribe = onValue(linksRef, (snapshot) => {
      const data = snapshot.val();
      const loadedLinks: ClickAndEarnLink[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setLinks(loadedLinks);
    });

    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val() as Partial<GlobalSettings>;
      if (data) {
        setPageSettings(prev => ({
            ...prev,
            pointsToCurrencyRate: data.pointsToCurrencyRate || 50,
            currencyPerRate: data.currencyPerRate || 49.5,
            clickAndEarnTitle: data.clickAndEarnTitle || prev.clickAndEarnTitle,
            clickAndEarnDescription: data.clickAndEarnDescription || prev.clickAndEarnDescription,
            dailyPointsLimit: data.dailyPointsLimit || 100,
        }));
      }
      setIsLoading(false);
    });
    
    return () => {
        off(linksRef, 'value', linksUnsubscribe);
        off(settingsRef, 'value', settingsUnsubscribe);
    };
  }, []);

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: { title: "", url: "", reward: 1 },
  });

  const handleAddLink = async (data: LinkFormValues) => {
    if (!database) return;
    const newLinkId = btoa(data.url).replace(/=/g, '');
    const newLinkRef = ref(database, `clickAndEarnLinks/${newLinkId}`);
    
    const newLinkData = { 
      ...data,
      reward: parseFloat(String(data.reward)),
      createdAt: serverTimestamp(),
      id: newLinkId
    };
    
    await set(newLinkRef, newLinkData);
    toast({ title: "Link Added", description: "New click & earn link has been added." });
    form.reset();
  };

  const handleDeleteLink = async (id: string) => {
    if (!database) return;
    await set(ref(database, `clickAndEarnLinks/${id}`), null);
    toast({ title: "Link Removed", description: "The link has been deleted." });
  };
  
  const handleSaveSettings = async () => {
      if (!database) return;
      setIsSaving(true);
      try {
        const settingsToUpdate = {
            pointsToCurrencyRate: Number(pageSettings.pointsToCurrencyRate),
            currencyPerRate: Number(pageSettings.currencyPerRate),
            clickAndEarnTitle: pageSettings.clickAndEarnTitle,
            clickAndEarnDescription: pageSettings.clickAndEarnDescription,
            dailyPointsLimit: Number(pageSettings.dailyPointsLimit),
        };
        await update(ref(database, 'globalSettings'), settingsToUpdate);
        toast({ title: "Settings Saved", description: "Page settings have been updated.", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      } catch (error) {
          toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  }

  const handleBulkUpload = async () => {
    if (!bulkLinksText.trim()) {
        toast({ title: "No links provided", description: "Please paste links into the text area.", variant: "destructive" });
        return;
    }
    if (!database) return;

    setIsBulkUploading(true);
    try {
        const existingLinksSnapshot = await get(ref(database, 'clickAndEarnLinks'));
        const existingLinks = existingLinksSnapshot.val() || {};

        const lines = bulkLinksText.split(/[\n\s]+/).map(line => line.trim()).filter(line => line.length > 0 && line.startsWith('http'));
        
        const updates: Record<string, any> = {};
        let addedCount = 0;
        let skippedCount = 0;

        for (const line of lines) {
            try {
                const url = new URL(line);
                const newLinkId = btoa(url.href).replace(/=/g, '');

                if (existingLinks[newLinkId]) {
                    skippedCount++;
                    continue;
                }
                
                const hostname = url.hostname.replace(/^www\./, '');
                const newLinkData: Omit<ClickAndEarnLink, 'id'> = {
                    title: `Ad Task - ${hostname}`,
                    url: url.href,
                    reward: parseFloat((Math.random() * (0.05 - 0.03) + 0.03).toFixed(5)),
                    createdAt: serverTimestamp(),
                };
                updates[`clickAndEarnLinks/${newLinkId}`] = newLinkData;
                addedCount++;
            } catch (error) {
                console.warn(`Skipping invalid URL during bulk upload: ${line}`);
                skippedCount++;
            }
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
            toast({
                title: "Bulk Upload Complete",
                description: `${addedCount} new links added. ${skippedCount} duplicates/invalid lines were skipped.`,
                className: "bg-green-500/20 text-green-300 border-green-500/30",
                duration: 7000,
            });
        } else {
            toast({ title: "No New Links", description: "No new or valid URLs were found in the provided text.", variant: "destructive" });
        }
        
        setBulkLinksText('');
    } catch (error: any) {
        toast({ title: "Database Error", description: "Failed to save links to the database.", variant: "destructive" });
    } finally {
        setIsBulkUploading(false);
    }
  };

  const handleDeleteAllLinks = async () => {
    if (!database) return;
    setIsDeletingAll(true);
    try {
        await remove(ref(database, 'clickAndEarnLinks'));
        toast({ title: "All Links Deleted", description: "All Click & Earn links have been removed.", className: "bg-green-500/20" });
    } catch (error) {
        toast({ title: "Error", description: "Could not delete all links.", variant: "destructive" });
    } finally {
        setIsDeletingAll(false);
    }
  };

  const handleDeleteUntitledLinks = async () => {
      if (!database) return;
      setIsDeletingUntitled(true);
      try {
          const linksRef = ref(database, 'clickAndEarnLinks');
          const snapshot = await get(linksRef);
          if (!snapshot.exists()) {
              toast({ title: "No Links Found", description: "There are no links to delete.", variant: "default" });
              setIsDeletingUntitled(false);
              return;
          }
          const allLinks = snapshot.val();
          const updates: Record<string, null> = {};
          let deletedCount = 0;
          for (const key in allLinks) {
              if (allLinks[key].title === 'Untitled Task' || !allLinks[key].title) {
                  updates[`clickAndEarnLinks/${key}`] = null;
                  deletedCount++;
              }
          }

          if (deletedCount > 0) {
              await update(ref(database), updates);
              toast({ title: "Cleanup Complete", description: `${deletedCount} untitled tasks have been deleted.`, className: "bg-green-500/20" });
          } else {
              toast({ title: "No Untitled Tasks Found", description: "All links have a valid title.", variant: "default" });
          }
      } catch (error) {
          toast({ title: "Error", description: "Could not delete untitled tasks.", variant: "destructive" });
      } finally {
          setIsDeletingUntitled(false);
      }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
          <PageTitle title="Click &amp; Earn Settings" subtitle="Manage links and points-to-currency conversion rates."/>
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
      </div>
      
       <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-4">Page &amp; Reward Settings</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
             <div className="space-y-1">
                <Label htmlFor="pointsToCurrencyRate">Minimum Points to Convert</Label>
                <Input id="pointsToCurrencyRate" type="number" value={pageSettings.pointsToCurrencyRate} onChange={e => setPageSettings(s => ({...s, pointsToCurrencyRate: Number(e.target.value)}))} placeholder="e.g., 50" />
            </div>
             <div className="space-y-1">
                <Label htmlFor="currencyPerRate">PKR Value for Conversion</Label>
                <Input id="currencyPerRate" type="number" step="any" value={pageSettings.currencyPerRate} onChange={e => setPageSettings(s => ({...s, currencyPerRate: Number(e.target.value)}))} placeholder="e.g., 49.5" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="dailyPointsLimit" className="flex items-center gap-1"><Target className="h-4 w-4"/>Daily Points Limit Per User</Label>
                <Input id="dailyPointsLimit" type="number" value={pageSettings.dailyPointsLimit} onChange={e => setPageSettings(s => ({...s, dailyPointsLimit: Number(e.target.value)}))} placeholder="e.g., 100" />
            </div>
         </div>
         <p className="text-xs text-muted-foreground mt-2">Example: If Minimum Points is {pageSettings.pointsToCurrencyRate} and PKR Value is {pageSettings.currencyPerRate}, users will get Rs {pageSettings.currencyPerRate} for every {pageSettings.pointsToCurrencyRate} points they convert.</p>
         
         <Separator className="my-6 bg-border/30" />
         <h4 className="text-lg font-semibold text-foreground mb-2">Alert Box Content</h4>
         <div className="space-y-4">
            <div className="space-y-1">
                <Label htmlFor="alertTitle">Alert Title</Label>
                <Input id="alertTitle" value={pageSettings.clickAndEarnTitle} onChange={e => setPageSettings(s => ({...s, clickAndEarnTitle: e.target.value}))} placeholder="e.g., Want higher rewards?" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="alertDescription">Alert Description</Label>
                <Textarea id="alertDescription" value={pageSettings.clickAndEarnDescription} onChange={e => setPageSettings(s => ({...s, clickAndEarnDescription: e.target.value}))} placeholder="e.g., Use a VPN from..." />
            </div>
         </div>
         
         <Button onClick={handleSaveSettings} disabled={isSaving} className="mt-6">
            {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4"/>}
            Save Page Settings
        </Button>
      </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-4">Add New Link (Manual)</h3>
        <form onSubmit={form.handleSubmit(handleAddLink)} className="space-y-4">
          <div className="space-y-1"><Label htmlFor="title">Task Title</Label><Input id="title" {...form.register('title')} placeholder="e.g., Watch YouTube Video" /></div>
          <div className="space-y-1"><Label htmlFor="url">Ad Link URL</Label><Input id="url" {...form.register('url')} placeholder="https://ad-link.com/..." /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-1"><Label htmlFor="reward">Points Reward</Label><Input id="reward" type="number" step="any" {...form.register('reward')} placeholder="e.g. 0.5" /></div>
             <Button type="submit" disabled={form.formState.isSubmitting} className="w-full md:w-auto"><PlusCircle className="mr-2 h-4"/> Add Link</Button>
          </div>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-4">Bulk Paste Links</h3>
        <p className="text-sm text-muted-foreground mb-4">Paste a list of URLs (one per line or separated by spaces) to add multiple links at once. A random reward between 0.03 and 0.05 will be assigned.</p>
        <div className="flex flex-col gap-4">
            <div className="w-full space-y-1">
                <Label htmlFor="bulk-paste-input">Paste Links Here</Label>
                <Textarea 
                    id="bulk-paste-input" 
                    value={bulkLinksText}
                    onChange={(e) => setBulkLinksText(e.target.value)}
                    className="h-48 font-mono text-xs bg-input/50"
                    placeholder="https://example.com/link1&#10;https://example.com/link2&#10;https://example.com/link3"
                />
            </div>
            <Button 
                onClick={handleBulkUpload} 
                disabled={isBulkUploading || !bulkLinksText.trim()} 
                className="w-full sm:w-auto neon-accent-bg"
            >
                {isBulkUploading ? <Loader2 className="mr-2 h-4 animate-spin"/> : <Upload className="mr-2 h-4"/>}
                Add Pasted Links
            </Button>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-xl font-semibold text-foreground">Existing Links ({links.length})</h3>
            <div className="flex gap-2 flex-wrap">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="bg-yellow-600 hover:bg-yellow-700" disabled={links.length === 0 || isDeletingUntitled}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Untitled
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card">
                        <AlertDialogHeader><AlertDialogTitle>Delete Untitled Tasks?</AlertDialogTitle><AlertDialogDescriptionDelete>This will permanently delete all links with the title "Untitled Task" or no title at all. This action cannot be undone.</AlertDialogDescriptionDelete></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUntitledLinks} disabled={isDeletingUntitled}>{isDeletingUntitled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Yes, Delete Untitled</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={links.length === 0 || isDeletingAll}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete All
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card">
                        <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescriptionDelete>This will permanently delete all {links.length} Click & Earn links. This action cannot be undone.</AlertDialogDescriptionDelete></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAllLinks} disabled={isDeletingAll}>{isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Yes, Delete All</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
        <ScrollArea className="h-96">
            <div className="space-y-3 pr-2">
                {links.length === 0 ? <p className="text-muted-foreground text-center py-4">No links added yet.</p> : links.map(link => (
                    <div key={link.id} className="p-3 border rounded-lg bg-background/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate" title={link.title}>{link.title || 'Untitled Task'}</p>
                            <p className="font-mono text-xs text-muted-foreground break-all truncate" title={link.url}>{link.url}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1"><span>Reward: <span className="font-semibold text-foreground">{link.reward} pts</span></span></div>
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteLink(link.id)} className="flex-shrink-0"><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
            </div>
        </ScrollArea>
      </GlassCard>
       <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" /><AlertTitle className="!text-primary">How It Works</AlertTitle><AlertDescription className="!text-primary/80">Users will see a single "Watch &amp; Earn" button. Clicking it serves a random available link. A link is on cooldown for 24 hours for a user after being clicked. After all links are clicked, there is a 24-hour global cooldown for the user.</AlertDescription>
        </Alert>
    </div>
  );
}
