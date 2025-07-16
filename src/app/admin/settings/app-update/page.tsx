
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { GlobalSettings, AppUpdateSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createDirectGoogleDriveDownloadLink } from '@/lib/image-helper';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Save, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const updateSettingsSchema = z.object({
  latestVersionCode: z.coerce.number().int().min(1, "Version code must be at least 1."),
  apkUrl: z.string().url("Please enter a valid URL."),
  forceUpdate: z.boolean(),
  updateMessage: z.string().min(10, "Update message is required."),
});

type UpdateSettingsFormValues = z.infer<typeof updateSettingsSchema>;

const defaultValues: UpdateSettingsFormValues = {
  latestVersionCode: 1,
  apkUrl: '',
  forceUpdate: true,
  updateMessage: 'A new version of the app is available. Please update to continue enjoying the latest features and security improvements.',
};

export default function AdminAppUpdatePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<UpdateSettingsFormValues>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues,
  });

  const fetchSettings = useCallback(async () => {
    if (!database) {
      toast({ title: "DB Error", description: "Database not available.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    try {
      const settingsRef = ref(database, 'globalSettings/appUpdate');
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        form.reset(snapshot.val());
      }
    } catch (error) {
      console.error("Error fetching app update settings:", error);
      toast({ title: "Fetch Error", description: "Could not load update settings.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (data: UpdateSettingsFormValues) => {
    if (!database) return;
    setIsSaving(true);
    
    try {
      // Convert Google Drive link to direct download link before saving
      const directDownloadUrl = createDirectGoogleDriveDownloadLink(data.apkUrl);
      
      const settingsToSave: AppUpdateSettings = {
        ...data,
        apkUrl: directDownloadUrl,
      };

      await update(ref(database, 'globalSettings/appUpdate'), settingsToSave);
      
      toast({
        title: "Settings Saved",
        description: "App update settings have been successfully updated.",
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <ArrowUpCircle className="mr-3 h-8 w-8 text-accent" /> App Update Settings
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
        </Button>
      </div>

      <GlassCard>
        <div className="space-y-6 p-6">
          <Controller
            control={form.control} name="latestVersionCode"
            render={({ field }) => (
              <div><Label htmlFor="versionCode">Latest Version Code</Label><Input id="versionCode" type="number" placeholder="e.g., 2" {...field} className="mt-1 bg-input/50" />
              {form.formState.errors.latestVersionCode && <p className="text-destructive text-sm mt-1">{form.formState.errors.latestVersionCode.message}</p>}</div>
            )}
          />
          <Controller
            control={form.control} name="apkUrl"
            render={({ field }) => (
              <div><Label htmlFor="apkUrl">APK Download URL (Google Drive)</Label><Input id="apkUrl" placeholder="https://drive.google.com/file/d/..." {...field} className="mt-1 bg-input/50" />
              <p className="text-xs text-muted-foreground mt-1">Paste the public share link from Google Drive. It will be converted automatically.</p>
              {form.formState.errors.apkUrl && <p className="text-destructive text-sm mt-1">{form.formState.errors.apkUrl.message}</p>}</div>
            )}
          />
          <Controller
            control={form.control} name="updateMessage"
            render={({ field }) => (
              <div><Label htmlFor="updateMessage">Update Message</Label><Textarea id="updateMessage" placeholder="Message to show users..." {...field} className="mt-1 bg-input/50" />
              {form.formState.errors.updateMessage && <p className="text-destructive text-sm mt-1">{form.formState.errors.updateMessage.message}</p>}</div>
            )}
          />
           <Controller
            control={form.control} name="forceUpdate"
            render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 shadow-sm">
                    <div className="space-y-0.5"><Label htmlFor="forceUpdate" className="text-base font-medium text-foreground">Force Update</Label>
                    <p className="text-xs text-muted-foreground">If enabled, users cannot dismiss the update dialog.</p></div>
                    <Switch id="forceUpdate" checked={field.value} onCheckedChange={field.onChange} />
                </div>
            )}
          />
        </div>
      </GlassCard>

      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">Important</AlertTitle>
        <AlertDescription className="!text-primary/80">
          This system relies on the Median.co wrapper. The `versionCode` must match the one in your Android `build.gradle` file when you build the APK.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSaving} className="neon-accent-bg">
          {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
          Save Update Settings
        </Button>
      </div>
    </form>
  );
}
