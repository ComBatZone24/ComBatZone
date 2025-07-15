
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { GlobalSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Save, Palette, Image as ImageIcon } from 'lucide-react';

interface BrandingSettings {
  appName: string;
  appLogoUrl: string;
}

const defaultSettings: BrandingSettings = {
  appName: 'ComBatZon',
  appLogoUrl: '',
};

export default function AdminBrandingSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<BrandingSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const settingsRef = ref(database, 'globalSettings');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          const fetchedData = snapshot.val() as Partial<GlobalSettings>;
          setSettings({
            appName: fetchedData.appName || defaultSettings.appName,
            appLogoUrl: fetchedData.appLogoUrl || defaultSettings.appLogoUrl,
          });
        }
      } catch (error) {
        console.error("Error fetching branding settings:", error);
        toast({ title: "Fetch Error", description: "Could not load branding settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Cannot save settings.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsToUpdate: Partial<GlobalSettings> = {
        appName: settings.appName,
        appLogoUrl: settings.appLogoUrl,
        updatedAt: serverTimestamp(),
      };
      await update(ref(database, 'globalSettings'), settingsToUpdate);
      toast({
        title: "Settings Saved",
        description: "Branding settings have been updated.",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Branding Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Palette className="mr-3 h-8 w-8 text-accent" /> App Branding
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>
      <GlassCard>
        <div className="space-y-6 p-6">
          <div>
            <Label htmlFor="appName" className="flex items-center text-muted-foreground"><ImageIcon className="mr-2 h-4 w-4" /> App Name</Label>
            <Input
              id="appName"
              value={settings.appName}
              onChange={(e) => setSettings(s => ({ ...s, appName: e.target.value }))}
              placeholder="Enter your app name"
              className="mt-1 bg-input/50 border-border/70 focus:border-accent"
            />
          </div>
          <div>
            <Label htmlFor="appLogoUrl" className="flex items-center text-muted-foreground"><ImageIcon className="mr-2 h-4 w-4" /> App Logo URL (Google Drive)</Label>
            <Input
              id="appLogoUrl"
              value={settings.appLogoUrl}
              onChange={(e) => setSettings(s => ({ ...s, appLogoUrl: e.target.value }))}
              placeholder="Enter public Google Drive share link for your logo"
              className="mt-1 bg-input/50 border-border/70 focus:border-accent"
            />
            <p className="text-xs text-muted-foreground mt-1">Make sure the Google Drive link is set to "Anyone with the link can view".</p>
          </div>
        </div>
        <div className="pt-6 mt-6 border-t border-border/30 flex justify-end p-6">
          <Button onClick={handleSave} disabled={isSaving} className="neon-accent-bg">
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
            Save Branding
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
