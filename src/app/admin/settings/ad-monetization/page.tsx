
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { ArrowLeft, Loader2, Save, Link as LinkIcon, PlusCircle, Trash2, Clock, UploadCloud } from 'lucide-react';
import Link from "next/link";
import PageTitle from "@/components/core/page-title";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const formSchema = z.object({
  enabled: z.boolean(),
  popupsEnabled: z.boolean(),
  popupMinInterval: z.coerce.number().min(1, "Minimum interval must be at least 1 minute."),
  popupMaxInterval: z.coerce.number().min(1, "Maximum interval must be at least 1 minute."),
  directLinks: z.array(z.object({
    url: z.string().url("Must be a valid URL.").min(1, "URL cannot be empty."),
  })).min(1, "You must provide at least one direct link."),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  enabled: true,
  popupsEnabled: true,
  popupMinInterval: 2,
  popupMaxInterval: 5,
  directLinks: [{ url: "" }],
};

export default function AdminAdMonetizationSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "directLinks",
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
          const settingsData = snapshot.val() as AdsterraSettings;
          const urls = Array.isArray(settingsData.directLinks) && settingsData.directLinks.length > 0
            ? settingsData.directLinks.map(url => ({ url }))
            : [{ url: '' }];

          form.reset({
            enabled: settingsData.enabled ?? defaultValues.enabled,
            popupsEnabled: settingsData.popupsEnabled ?? defaultValues.popupsEnabled,
            popupMinInterval: settingsData.popupMinInterval ?? defaultValues.popupMinInterval,
            popupMaxInterval: settingsData.popupMaxInterval ?? defaultValues.popupMaxInterval,
            directLinks: urls,
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
            ...data,
            directLinks: data.directLinks.map(item => item.url.trim()).filter(Boolean),
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
  
  const handleAddBulkLinks = () => {
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
    
    const currentUrls = form.getValues('directLinks').map(item => item.url).filter(Boolean);
    const newUrls = [...currentUrls, ...urls.map(u => u.trim())];
    
    replace(newUrls.map(url => ({ url })));

    toast({ title: "Links Added", description: `${urls.length} new links have been added to the list. Don't forget to save.` });
    setBulkUrls('');
  };

  const handleDeleteAllLinks = () => {
    replace([]); // Replace the array with an empty one
    toast({ title: "All Links Cleared", description: "The list has been cleared. Press 'Save Settings' to confirm." });
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between mb-8">
           <PageTitle title="Adsterra Ad Settings" subtitle="Configure direct links and automatic pop-up ads." />
           <Button variant="outline" asChild><Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link></Button>
        </div>
      
        <GlassCard>
            <div className="space-y-6 p-6">
                <FormField
                    control={form.control} name="enabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                            <div className="space-y-0.5"><FormLabel className="text-base font-medium text-foreground">Enable Adsterra System</FormLabel><p className="text-xs text-muted-foreground">Master switch for all Adsterra features.</p></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control} name="popupsEnabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                            <div className="space-y-0.5"><FormLabel className="text-base font-medium text-foreground">Enable Automatic Pop-up Ads</FormLabel><p className="text-xs text-muted-foreground">Randomly show full-screen ads to users.</p></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />

                <Separator className="bg-border/40"/>

                <h4 className="font-semibold text-lg text-foreground flex items-center gap-2"><Clock className="h-5 w-5 text-accent"/>Pop-up Ad Timing (in minutes)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="popupMinInterval" render={({ field }) => (
                        <FormItem><FormLabel>Minimum Interval</FormLabel><Input type="number" {...field} placeholder="e.g., 2" /><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="popupMaxInterval" render={({ field }) => (
                        <FormItem><FormLabel>Maximum Interval</FormLabel><Input type="number" {...field} placeholder="e.g., 5" /><FormMessage /></FormItem>
                    )}/>
                </div>
            </div>
       </GlassCard>

       <GlassCard>
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center gap-4">
                  <h4 className="font-semibold text-lg text-foreground flex items-center gap-2"><LinkIcon className="h-5 w-5 text-accent"/>Manage Adsterra Direct Links</h4>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={fields.length === 0}><Trash2 className="mr-2 h-3 w-3"/>Delete All</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete all {fields.length} ad links from the list. This cannot be undone. You must click "Save Settings" afterwards to confirm this change.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllLinks} className="bg-destructive hover:bg-destructive/90">Delete Links</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
                  <div className="space-y-3">
                      {fields.map((field, index) => (
                          <FormField
                              key={field.id}
                              control={form.control}
                              name={`directLinks.${index}.url`}
                              render={({ field: formField }) => (
                                  <FormItem>
                                      <div className="flex items-center gap-2">
                                          <FormControl><Input {...formField} placeholder="https://... direct link" /></FormControl>
                                          <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                      </div>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                      ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => append({ url: '' })} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" />Add Another Link</Button>
                
                <Separator className="bg-border/30" />

                <div>
                    <h4 className="font-semibold text-lg text-foreground flex items-center gap-2 mb-4"><UploadCloud className="h-5 w-5 text-accent"/>Bulk Add Links</h4>
                    <div className="space-y-2">
                        <Label htmlFor="bulk-urls">Paste Multiple URLs</Label>
                        <Textarea 
                            id="bulk-urls"
                            placeholder="Paste URLs here, separated by new lines, spaces, or commas."
                            value={bulkUrls}
                            onChange={(e) => setBulkUrls(e.target.value)}
                            className="h-24 bg-input/50"
                        />
                        <Button type="button" onClick={handleAddBulkLinks} className="w-full">
                            <UploadCloud className="mr-2"/> Add Links to List
                        </Button>
                    </div>
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
    </Form>
  );
}

