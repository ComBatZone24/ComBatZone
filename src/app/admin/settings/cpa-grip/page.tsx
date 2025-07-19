
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
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
import { ArrowLeft, Loader2, Save, Link as LinkIcon, AlertCircle, Coins, KeyRound, Copy, PlusCircle, Trash2 } from 'lucide-react';
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
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
    enabled: false,
    title: 'Complete an Offer',
    description: 'Complete a quick offer from our partners to earn a special reward instantly!',
    offerUrls: [{ url: '' }],
    points: 100,
    postbackKey: '',
};

export default function CpaGripSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });
    
    const { fields, append, remove } = useFieldArray({
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
                offerUrls: data.offerUrls.map(item => item.url)
            };
            await update(ref(database, 'globalSettings/cpaGripSettings'), settingsToSave);
            toast({
                title: "Settings Saved",
                description: "CPAGrip settings have been updated.",
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
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
                        CPAGrip &amp; Postback
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
                                    <FormLabel className="text-base font-medium text-foreground">Enable CPAGrip Offers</FormLabel>
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
                    <div className="space-y-4">
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><Label>Title</Label><FormControl><Input {...field} placeholder="e.g. Complete an Offer" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><Label>Description</Label><FormControl><Textarea {...field} placeholder="e.g. Complete a quick offer..." /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="points" render={({ field }) => (<FormItem><Label className="flex items-center gap-2"><Coins className="h-4"/>Points Reward</Label><FormControl><Input type="number" {...field} placeholder="e.g. 100" /></FormControl><FormMessage /></FormItem>)} />
                        
                        <div className="space-y-2 pt-4">
                            <Label className="flex items-center gap-2 text-md"><LinkIcon className="h-5"/>Offer URLs</Label>
                             <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`offerUrls.${index}.url`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="flex items-center gap-2">
                                                    <FormControl><Input {...field} placeholder="Your CPAGrip Locker URL" /></FormControl>
                                                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ url: ''})}>
                                <PlusCircle className="mr-2 h-4 w-4"/> Add Another URL
                            </Button>
                        </div>
                    </div>
                </GlassCard>
                
                 <GlassCard>
                    <h3 className="text-xl font-semibold text-foreground mb-1">Postback Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-4">This is for automatically verifying offer completions.</p>
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
                   1. For EACH of your offer URLs in CPAGrip, you must append these parameters for tracking: `&amp;sub1=&#123;tracking_id&#125;&amp;sub2=YOUR_SECRET_KEY&amp;offer_url_id=&#123;offer_url_id&#125;`. Replace `YOUR_SECRET_KEY` with the key you set above.
                   <br/>2. In CPAGrip, set your "Global Postback" to the URL generated above. This is how we verify completions automatically.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving} className="neon-accent-bg">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                    Save CPAGrip Settings
                  </Button>
                </div>
            </form>
        </Form>
    );
}
