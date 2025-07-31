
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp, push } from 'firebase/database';
import type { GlobalSettings, CpaGripSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { ArrowLeft, Loader2, Save, Link as LinkIcon, AlertCircle, Coins, KeyRound, Copy, PlusCircle, Trash2, UploadCloud, Edit3, X, Target } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  offerUrls: z.array(z.object({
    url: z.string().url("Link must be a valid URL (e.g., https://...)").min(1, "URL cannot be empty."),
  })).min(1, "You must provide at least one offer URL."),
  points: z.coerce.number().min(0, "Points reward must be non-negative."),
  postbackKey: z.string().min(10, "Secret key must be at least 10 characters long for security."),
  requiredCompletions: z.coerce.number().int().min(1, "Required completions must be at least 1.").default(1),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
    enabled: false,
    title: 'Complete an Offer',
    description: 'Complete a quick offer from our partners to earn a special reward instantly!',
    offerUrls: [{ url: '' }],
    points: 100,
    postbackKey: '',
    requiredCompletions: 1,
};

export default function CpaGripSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [bulkUrls, setBulkUrls] = useState("");
    
    const [manualLink, setManualLink] = useState("");
    const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });
    
    const { fields, append, remove, replace, update: updateFieldArray } = useFieldArray({
      control: form.control,
      name: "offerUrls",
    });

    useEffect(() => {
        const fetchSettings = async () => {
            if (!database) {
                setIsLoading(false);
                return;
            }
            try {
                const settingsRef = ref(database, 'globalSettings/cpaGripSettings');
                const snapshot = await get(settingsRef);
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const urls = Array.isArray(data.offerUrls) && data.offerUrls.length > 0
                        ? data.offerUrls.map((url: string) => ({ url }))
                        : [{ url: '' }];
                    form.reset({ ...defaultValues, ...data, offerUrls: urls });
                } else {
                    form.reset({ ...defaultValues, postbackKey: Math.random().toString(36).substring(2, 15) });
                }
            } catch (error) {
                console.error("Error fetching CPAGrip settings:", error);
                toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [form, toast]);

    const postbackUrl = useMemo(() => {
        if (typeof window === 'undefined') return '';
        const key = form.watch('postbackKey');
        return `${window.location.origin}/api/cpa-postback?sub1={tracking_id}&sub2=${key}&payout={payout_usd}&offer_id={offer_id}&offer_name={offer_name}&offer_url_id={offer_url_id}`;
    }, [form.watch('postbackKey')]);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(postbackUrl);
        toast({ title: "Copied!", description: "Postback URL copied to clipboard." });
    };

    const onSubmit = async (data: FormValues) => {
        if (!database) return;
        setIsSaving(true);
        try {
            const settingsToSave: Partial<CpaGripSettings> = { 
                ...data,
                offerUrls: data.offerUrls.map(item => item.url.trim()).filter(Boolean)
            };
            await update(ref(database, 'globalSettings/cpaGripSettings'), settingsToSave);
            toast({
                title: "Settings Saved",
                description: "Offer Wall settings have been updated.",
                className: "bg-green-500/20 text-green-300 border-green-500/30",
            });
        } catch (error: any) {
            toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddOrUpdateManualLink = () => {
        if (!manualLink.trim()) {
            toast({ title: "Input Error", description: "Please enter a URL.", variant: "destructive" });
            return;
        }
        try {
            new URL(manualLink.trim()); // Validate URL
        } catch (_) {
            toast({ title: "Invalid URL", description: "Please enter a valid URL format (e.g., https://...).", variant: "destructive" });
            return;
        }

        if (editingLinkIndex !== null) {
            updateFieldArray(editingLinkIndex, { url: manualLink.trim() });
            toast({ title: "Link Updated", description: "Link updated in the list. Don't forget to save changes." });
        } else {
            append({ url: manualLink.trim() });
            toast({ title: "Link Added", description: "Link added to the list. Don't forget to save changes." });
        }
        setManualLink("");
        setEditingLinkIndex(null);
    };

    const handleEditLink = (index: number) => {
        setEditingLinkIndex(index);
        setManualLink(fields[index].url);
    };

    const handleCancelEdit = () => {
        setEditingLinkIndex(null);
        setManualLink("");
    };

    const handleAddBulkLinks = () => {
        const urlsToAdd = bulkUrls.split(/[\s,]+/).filter(url => {
          try { new URL(url.trim()); return true; } catch (e) { return false; }
        });
    
        if (urlsToAdd.length === 0) {
          toast({ title: "No Valid URLs", description: "Please paste at least one valid URL.", variant: "destructive" });
          return;
        }
    
        const currentUrls = form.getValues('offerUrls').map(item => item.url).filter(Boolean);
        const newUrls = [...currentUrls, ...urlsToAdd.map(u => u.trim())];
        
        replace(newUrls.map(url => ({ url })));
    
        toast({ title: "Links Added", description: `${urlsToAdd.length} new links have been added to the list below. Don't forget to save.` });
        setBulkUrls('');
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
                        Offer Wall &amp; Postback
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
                                    <FormLabel className="text-base font-medium text-foreground">Enable Offer Wall Task</FormLabel>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                </GlassCard>

                <GlassCard>
                    <h3 className="text-xl font-semibold text-foreground mb-1">Offer Details</h3>
                    <p className="text-sm text-muted-foreground mb-4">How the offer card will appear to users.</p>
                    <Separator className="mb-6 bg-border/30" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><Label>Title</Label><FormControl><Input {...field} placeholder="e.g. Complete an Offer" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><Label>Description</Label><FormControl><Textarea {...field} placeholder="e.g. Complete a quick offer..." /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </GlassCard>
                
                 <GlassCard>
                    <h3 className="text-xl font-semibold text-foreground mb-1">Reward & Milestone</h3>
                    <p className="text-sm text-muted-foreground mb-4">Set the reward and how many offers a user must complete to earn it.</p>
                     <Separator className="mb-6 bg-border/30" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="points" render={({ field }) => (<FormItem><Label className="flex items-center gap-2"><Coins className="h-4"/>Points Reward</Label><FormControl><Input type="number" {...field} placeholder="e.g. 100" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="requiredCompletions" render={({ field }) => (<FormItem><Label className="flex items-center gap-2"><Target className="h-4"/>Required Offer Completions</Label><FormControl><Input type="number" {...field} placeholder="e.g. 5" min="1" /></FormControl><FormMessage /><p className="text-xs text-muted-foreground mt-1">Number of offers to complete for reward. Use '1' for instant reward per offer.</p></FormItem>)} />
                    </div>
                </GlassCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassCard>
                         <h3 className="text-lg font-semibold text-foreground mb-2">Add or Edit Link</h3>
                         <div className="space-y-2">
                             <Label htmlFor="manual-url">Offer URL</Label>
                             <div className="flex gap-2">
                                <Input id="manual-url" placeholder="Paste single URL here" value={manualLink} onChange={(e) => setManualLink(e.target.value)} className="bg-input/50"/>
                                {editingLinkIndex !== null && <Button type="button" variant="ghost" size="icon" onClick={handleCancelEdit}><X className="h-4 w-4"/></Button>}
                             </div>
                             <Button type="button" onClick={handleAddOrUpdateManualLink} className="w-full">
                                {editingLinkIndex !== null ? 'Update Link' : 'Add Link'}
                             </Button>
                         </div>
                         <Separator className="my-4"/>
                         <h3 className="text-lg font-semibold text-foreground mb-2">Bulk Add Links</h3>
                         <div className="space-y-2">
                             <Label htmlFor="bulk-urls">Paste Multiple URLs</Label>
                             <Textarea id="bulk-urls" placeholder="Paste URLs here, separated by new lines, spaces, or commas." value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} className="h-20 bg-input/50"/>
                             <Button type="button" onClick={handleAddBulkLinks} className="w-full"><UploadCloud className="mr-2"/> Add to List</Button>
                         </div>
                    </GlassCard>

                    <GlassCard>
                         <h3 className="text-lg font-semibold text-foreground mb-2">Manage Offer URLs ({fields.length})</h3>
                         <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {fields.map((field, index) => (
                                <FormField
                                    key={field.id}
                                    control={form.control}
                                    name={`offerUrls.${index}.url`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormControl><Input {...field} readOnly className="bg-muted/30"/></FormControl>
                                                <Button type="button" variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300" onClick={() => handleEditLink(index)}><Edit3 className="h-4 w-4"/></Button>
                                                <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    </GlassCard>
                </div>
                
                 <GlassCard>
                    <h3 className="text-xl font-semibold text-foreground mb-1">Postback Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-4">For automatically verifying offer completions from networks like CPAGrip.</p>
                    <Separator className="mb-6 bg-border/30" />
                    <div className="space-y-4">
                        <FormField control={form.control} name="postbackKey" render={({ field }) => (<FormItem><Label className="flex items-center gap-2"><KeyRound className="h-4"/>Postback Secret Key</Label><FormControl><Input {...field} /></FormControl><FormMessage /><p className="text-xs text-muted-foreground mt-1">A unique, secret key to prevent fraud. Should match `sub2` in your URL.</p></FormItem>)} />
                         <div>
                            <Label className="flex items-center gap-2"><LinkIcon className="h-4"/>Your Postback URL</Label>
                            <div className="flex items-center gap-2 mt-1">
                               <Input value={postbackUrl} readOnly className="bg-muted/50 border-border/70" />
                               <Button type="button" variant="outline" size="icon" onClick={handleCopyUrl}><Copy className="h-4"/></Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Paste this URL into your CPAGrip "Global Postback" settings.</p>
                        </div>
                    </div>
                </GlassCard>

                <Alert variant="default" className="bg-primary/10 border-primary/30">
                  <AlertCircle className="h-5 w-5 !text-primary" />
                  <AlertTitle className="!text-primary">Important Setup</AlertTitle>
                  <AlertDescription className="!text-primary/80 text-sm">
                   1. For EACH of your offer URLs in your network (e.g. CPAGrip), you must append these parameters for tracking: `{`&sub1={tracking_id}&sub2=YOUR_SECRET_KEY&offer_url_id={offer_url_id}`}`. Replace `YOUR_SECRET_KEY` with the key you set above.
                   <br/>2. In your network, set your "Global Postback" to the URL generated above. This is how we verify completions automatically.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving} className="neon-accent-bg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Save Offer Wall Settings
                  </Button>
                </div>
            </form>
        </Form>
    );
}
