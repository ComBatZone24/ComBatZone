
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { GlobalSettings, YouTubePromotionSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Save, Youtube, Tv, Image as ImageIcon, Link as LinkIcon, Gift, User, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const youtubeSettingsSchema = z.object({
  enabled: z.boolean(),
  youtubeChannelName: z.string().min(1, "Channel name is required."),
  youtubeChannelUrl: z.string().url("Must be a valid YouTube channel URL."),
  youtubeChannelBannerUrl: z.string().url("Must be a valid URL for the banner.").or(z.literal('')),
  youtubeChannelProfileUrl: z.string().url("Must be a valid URL for the profile picture.").or(z.literal('')),
  pointsForSubscription: z.coerce.number().min(0, "Points must be non-negative."),
  liveStreamUrl: z.string().url("Must be a valid YouTube URL.").or(z.literal('')),
  liveStreamEnabled: z.boolean(),
});

type YoutubeSettingsFormValues = z.infer<typeof youtubeSettingsSchema>;

const defaultSettings: YoutubeSettingsFormValues = {
    enabled: true,
    youtubeChannelName: '',
    youtubeChannelUrl: '',
    youtubeChannelBannerUrl: '',
    youtubeChannelProfileUrl: '',
    pointsForSubscription: 100,
    liveStreamUrl: '',
    liveStreamEnabled: false,
};

export default function AdminYoutubePromotionSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<YoutubeSettingsFormValues>({
    resolver: zodResolver(youtubeSettingsSchema),
    defaultValues: defaultSettings,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) { setIsLoading(false); return; }
      try {
        const settingsRef = ref(database, 'globalSettings/youtubePromotionSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          form.reset({ ...defaultSettings, ...snapshot.val() });
        }
      } catch (error) {
        console.error("Error fetching YouTube promotion settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  const handleSave = async (data: YoutubeSettingsFormValues) => {
    if (!database) return;
    setIsSaving(true);
    try {
      const settingsToUpdate = { ...data, updatedAt: serverTimestamp() };
      await update(ref(database, 'globalSettings/youtubePromotionSettings'), settingsToUpdate);
      toast({
        title: "Settings Saved",
        description: "YouTube Promotion settings have been updated.",
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
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Youtube className="mr-3 h-8 w-8 text-red-500" /> YouTube Promotion
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
        </Button>
      </div>

       <GlassCard>
            <Controller
                name="enabled"
                control={form.control}
                render={({ field }) => (
                    <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30">
                        <Label htmlFor="enabled" className="flex flex-col space-y-1">
                            <span className="text-md font-medium text-foreground cursor-pointer">Enable YouTube Subscription Task</span>
                            <span className="font-normal text-xs text-muted-foreground">If disabled, this entire task will be hidden from users.</span>
                        </Label>
                        <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                )}
            />
       </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-1">Channel Promotion Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">Details for the channel users need to subscribe to.</p>
        <Separator className="mb-6 bg-border/30" />
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="youtubeChannelName" label="Channel Name" placeholder="e.g., Arena Ace Gaming" control={form.control} />
                <FormField name="youtubeChannelUrl" label="Channel URL" placeholder="https://youtube.com/c/..." control={form.control} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="youtubeChannelProfileUrl" label="Channel Profile Picture URL" icon={ImageIcon} control={form.control} />
                <FormField name="youtubeChannelBannerUrl" label="Channel Banner Image URL" icon={ImageIcon} control={form.control} />
            </div>
            <FormField name="pointsForSubscription" label="Points for Subscription" type="number" icon={Gift} control={form.control} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-1">Live Stream Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">Embed a YouTube live stream on the "Watch &amp; Earn" page.</p>
        <Separator className="mb-6 bg-border/30" />
         <div className="space-y-4">
            <Controller
                name="liveStreamEnabled"
                control={form.control}
                render={({ field }) => (
                    <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30">
                        <Label htmlFor="liveStreamEnabled" className="text-md font-medium text-foreground cursor-pointer">Enable Live Stream Section</Label>
                        <Switch id="liveStreamEnabled" checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                )}
            />
            <FormField name="liveStreamUrl" label="Live Stream URL" icon={Tv} control={form.control} placeholder="https://www.youtube.com/watch?v=..." />
         </div>
      </GlassCard>

      <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">AI Screenshot Verification</AlertTitle>
          <AlertDescription className="!text-primary/80">
            The system uses AI to verify that the user's uploaded screenshot shows the correct channel name and a "Subscribed" status. Ensure your provided channel name is accurate.
          </AlertDescription>
        </Alert>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSaving} className="neon-accent-bg">
          {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
          Save YouTube Settings
        </Button>
      </div>
    </form>
  );
}

const FormField: React.FC<{name: any; label: string; control: any; type?: string; placeholder?: string; icon?: React.ElementType}> = ({ name, label, control, type = "text", placeholder, icon: Icon }) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState: { error } }) => (
      <div>
        <Label htmlFor={name} className="text-sm font-medium text-muted-foreground flex items-center mb-1">
          {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground/80" />}
          {label}
        </Label>
        <Input
          id={name} type={type} placeholder={placeholder}
          className="bg-input/50 border-border/70 focus:border-accent"
          {...field}
          value={field.value || ''}
        />
        {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
      </div>
    )}
  />
);
