
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, onValue, off } from 'firebase/database';
import type { GlobalSettings, Tournament, ShopItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, Save, Gift, AlertCircle, ShoppingCart, Gamepad2, Tv, Globe } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type PromoPopupSettings = NonNullable<GlobalSettings['promoPopup']>;

const defaultSettings: PromoPopupSettings = {
  enabled: true,
  promoType: 'media',
  promoMediaUrl: '',
  promoMediaType: 'image',
  selectedItemId: null,
  displayLocation: 'homepage',
  promoTitle: 'Special Announcement',
  promoDescription: "Check out what's new!",
  promoButtonText: 'Explore Now',
  promoButtonLink: '/',
};

export default function AdminPromoPopupSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PromoPopupSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const settingsRef = ref(database, 'globalSettings/promoPopup');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          setSettings({ ...defaultSettings, ...snapshot.val() });
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Error fetching promo pop-up settings:", error);
        toast({ title: "Fetch Error", description: "Could not load settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchRelatedData = () => {
        if (!database) {
            setIsDataLoading(false);
            return;
        }
        setIsDataLoading(true);
        const tournamentsRef = ref(database, 'tournaments');
        const shopItemsRef = ref(database, 'shopItems');

        const tournamentsListener = onValue(tournamentsRef, (snapshot) => {
            const data = snapshot.val();
            const loadedTournaments: Tournament[] = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
            setTournaments(loadedTournaments.filter(t => t.status === 'upcoming'));
        }, (error) => console.error("Error fetching tournaments for promo", error));
        
        const shopItemsListener = onValue(shopItemsRef, (snapshot) => {
            const data = snapshot.val();
            const loadedItems: ShopItem[] = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
            setShopItems(loadedItems.filter(i => i.active));
        }, (error) => console.error("Error fetching shop items for promo", error));

        Promise.all([get(tournamentsRef), get(shopItemsRef)]).finally(() => setIsDataLoading(false));

        return () => {
            off(tournamentsRef, 'value', tournamentsListener);
            off(shopItemsRef, 'value', shopItemsListener);
        }
    }

    fetchSettings();
    fetchRelatedData();
  }, [toast]);

  const handleSave = async () => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Cannot save settings.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsRef = ref(database, 'globalSettings/promoPopup');
      // Ensure we only save relevant data per promo type
      const dataToSave: PromoPopupSettings = {
        ...settings,
        promoMediaUrl: settings.promoType === 'media' ? (settings.promoMediaUrl || null) : null,
        selectedItemId: settings.promoType !== 'media' ? (settings.selectedItemId || null) : null,
        displayLocation: settings.displayLocation || 'homepage',
        promoTitle: settings.promoType === 'media' ? (settings.promoTitle || null) : null,
        promoDescription: settings.promoType === 'media' ? (settings.promoDescription || null) : null,
        promoButtonText: settings.promoType === 'media' ? (settings.promoButtonText || null) : null,
        promoButtonLink: settings.promoType === 'media' ? (settings.promoButtonLink || null) : null,
      };
      await update(settingsRef, dataToSave);
      toast({
        title: "Settings Saved",
        description: "Promotional pop-up settings have been updated.",
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Pop-up Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Gift className="mr-3 h-8 w-8 text-accent" /> Promotional Pop-up Settings
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <GlassCard>
        <div className="space-y-6">
          <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30">
            <Label htmlFor="enabled" className="text-md font-medium text-foreground cursor-pointer">
              Enable Promotional Pop-up
            </Label>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
              className="data-[state=checked]:bg-accent"
            />
          </div>

          <div>
            <Label className="flex items-center"><Globe className="mr-2 h-4 w-4 text-muted-foreground"/>Display Location</Label>
            <RadioGroup
              value={settings.displayLocation || 'homepage'}
              onValueChange={(value) => setSettings(s => ({ ...s, displayLocation: value as 'homepage' | 'all_pages' }))}
              className="flex flex-wrap gap-4 mt-2"
            >
              <div className="flex items-center space-x-2"><RadioGroupItem value="homepage" id="loc-homepage" /><Label htmlFor="loc-homepage">Homepage Only</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="all_pages" id="loc-all" /><Label htmlFor="loc-all">All User Pages</Label></div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-1">Choose where the promotional banner appears for users.</p>
          </div>

          <div>
            <Label>Promotion Type</Label>
            <RadioGroup
              value={settings.promoType}
              onValueChange={(value) => setSettings(s => ({ ...s, promoType: value as PromoPopupSettings['promoType'] }))}
              className="flex flex-wrap gap-4 mt-2"
            >
              <div className="flex items-center space-x-2"><RadioGroupItem value="media" id="type-media" /><Label htmlFor="type-media" className="flex items-center gap-2"><Tv /> Media (Image/Video)</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="tournament" id="type-tournament" /><Label htmlFor="type-tournament" className="flex items-center gap-2"><Gamepad2/> Tournament</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="product" id="type-product" /><Label htmlFor="type-product" className="flex items-center gap-2"><ShoppingCart/> Product</Label></div>
            </RadioGroup>
          </div>

          {settings.promoType === 'media' && (
            <div className="space-y-4 p-4 border border-border/50 rounded-md">
                <h4 className="font-semibold text-muted-foreground">Media Settings</h4>
                 <div>
                    <Label htmlFor="promoMediaUrl">Media URL (Image or YouTube)</Label>
                    <Input
                    id="promoMediaUrl"
                    value={settings.promoMediaUrl || ''}
                    onChange={(e) => setSettings(s => ({ ...s, promoMediaUrl: e.target.value }))}
                    placeholder="e.g., https://example.com/promo.gif or YouTube link"
                    className="mt-1 bg-input/50 border-border/70 focus:border-accent"
                    />
                </div>
                 <div>
                    <Label>Media Type</Label>
                    <RadioGroup
                    value={settings.promoMediaType}
                    onValueChange={(value) => setSettings(s => ({ ...s, promoMediaType: value as 'image' | 'video' }))}
                    className="flex gap-4 mt-2"
                    >
                    <div className="flex items-center space-x-2"><RadioGroupItem value="image" id="mtype-image" /><Label htmlFor="mtype-image">Image / GIF</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="video" id="mtype-video" /><Label htmlFor="mtype-video">YouTube Video</Label></div>
                    </RadioGroup>
                </div>
                <div className='pt-2 space-y-4'>
                    <Label>Custom Content (for Media Type)</Label>
                    <Input id="promoTitle" value={settings.promoTitle || ''} onChange={(e) => setSettings(s => ({ ...s, promoTitle: e.target.value }))} placeholder="Custom Title" className="bg-input/50"/>
                    <Textarea id="promoDescription" value={settings.promoDescription || ''} onChange={(e) => setSettings(s => ({...s, promoDescription: e.target.value }))} placeholder="Custom Description (optional)" className="bg-input/50" />
                    <Input id="promoButtonText" value={settings.promoButtonText || ''} onChange={(e) => setSettings(s => ({...s, promoButtonText: e.target.value }))} placeholder="Button Text (e.g., Learn More)" className="bg-input/50"/>
                    <Input id="promoButtonLink" value={settings.promoButtonLink || ''} onChange={(e) => setSettings(s => ({...s, promoButtonLink: e.target.value }))} placeholder="Button Link (e.g., /tournaments)" className="bg-input/50"/>
                </div>
            </div>
          )}

          {settings.promoType === 'tournament' && (
             <div className="space-y-2 p-4 border border-border/50 rounded-md">
                <h4 className="font-semibold text-muted-foreground">Select Tournament</h4>
                <Select value={settings.selectedItemId || ''} onValueChange={(value) => setSettings(s => ({...s, selectedItemId: value}))} disabled={isDataLoading}>
                    <SelectTrigger><SelectValue placeholder={isDataLoading ? "Loading tournaments..." : "Select an upcoming tournament"} /></SelectTrigger>
                    <SelectContent className="glass-card">
                        {tournaments.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.game})</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          )}

          {settings.promoType === 'product' && (
             <div className="space-y-2 p-4 border border-border/50 rounded-md">
                <h4 className="font-semibold text-muted-foreground">Select Product</h4>
                <Select value={settings.selectedItemId || ''} onValueChange={(value) => setSettings(s => ({...s, selectedItemId: value}))} disabled={isDataLoading}>
                    <SelectTrigger><SelectValue placeholder={isDataLoading ? "Loading products..." : "Select a shop item"} /></SelectTrigger>
                    <SelectContent className="glass-card">
                        {shopItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name} - Rs {item.price}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-6 mt-6 border-t border-border/30">
          <Button onClick={handleSave} disabled={isSaving} className="neon-accent-bg">
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
            Save Settings
          </Button>
        </div>
      </GlassCard>

      <Alert variant="default" className="bg-primary/10 border-primary/30">
        <AlertCircle className="h-5 w-5 !text-primary" />
        <AlertTitle className="!text-primary">How it Works</AlertTitle>
        <AlertDescription className="!text-primary/80 text-sm space-y-1">
          <p>If enabled, this pop-up banner will appear on every page load for regular users and delegates.</p>
          <p>It will not display for Admins. You can control if it appears on just the homepage or all user-facing pages.</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
