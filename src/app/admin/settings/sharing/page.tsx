
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Share2, Save, Loader2, ArrowLeft, AlertCircle, DollarSign, Link2 as LinkIconLucide } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GlobalSettings } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';

const initialShareSettings: Pick<GlobalSettings, 
  'shareAndEarnEnabled' | 
  'referralBonusAmount' | 
  'shareLinkBaseUrl'
> = {
  shareAndEarnEnabled: false,
  referralBonusAmount: 10, // Default bonus amount
  shareLinkBaseUrl: '', // Default empty base URL
};

export default function AdminShareAndEarnSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialShareSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsFetchingSettings(false);
        setSettings(initialShareSettings);
        return;
      }
      setIsFetchingSettings(true);
      try {
        const globalSettingsRef = ref(database, 'globalSettings');
        const snapshot = await get(globalSettingsRef);
        
        if (snapshot.exists()) {
          const fetchedGlobalSettings = snapshot.val() as Partial<GlobalSettings>;
          setSettings({
            shareAndEarnEnabled: fetchedGlobalSettings.shareAndEarnEnabled ?? initialShareSettings.shareAndEarnEnabled,
            referralBonusAmount: fetchedGlobalSettings.referralBonusAmount ?? initialShareSettings.referralBonusAmount,
            shareLinkBaseUrl: fetchedGlobalSettings.shareLinkBaseUrl ?? initialShareSettings.shareLinkBaseUrl,
          });
        } else {
          setSettings(initialShareSettings);
          toast({ title: "Defaults Loaded", description: "Share & Earn settings not found, using defaults. Save to create.", variant: "default" });
        }
      } catch (error) {
        console.error("Error fetching Share & Earn settings:", error);
        toast({ title: "Settings Error", description: "Could not load Share & Earn settings from Firebase.", variant: "destructive" });
        setSettings(initialShareSettings);
      } finally {
        setIsFetchingSettings(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmitSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized. Cannot save settings.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const settingsToUpdate: Partial<GlobalSettings> = {
        shareAndEarnEnabled: settings.shareAndEarnEnabled,
        referralBonusAmount: settings.referralBonusAmount,
        shareLinkBaseUrl: settings.shareLinkBaseUrl,
        updatedAt: serverTimestamp() 
      };

      await update(ref(database, 'globalSettings'), settingsToUpdate);
      
      toast({
        title: "Share & Earn Settings Saved",
        description: "Global referral program configuration has been updated and will apply to all users.",
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error) {
        console.error("Error saving Share & Earn settings:", error);
        toast({ title: "Save Error", description: "Could not save settings. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  if (isFetchingSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Share & Earn Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Share2 className="mr-3 h-8 w-8 text-accent"/> Share & Earn Configuration
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmitSettings} className="space-y-8">
        <GlassCard>
          <h3 className="text-xl font-semibold text-foreground mb-1">Referral Program Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">Configure the referral bonus and sharing link.</p>
          <Separator className="mb-6 bg-border/30" />
          
          <div className="space-y-6">
            <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30">
              <Label htmlFor="shareAndEarnEnabled" className="flex items-center text-md font-medium text-foreground cursor-pointer">
                <Share2 className="mr-2 h-5 w-5 text-accent" />
                Enable Share & Earn Feature
              </Label>
              <Switch 
  id="shareAndEarnEnabled" 
  name="shareAndEarnEnabled"
  checked={settings.shareAndEarnEnabled} 
  onCheckedChange={(checked) => {
    setSettings(prev => ({ 
      ...prev, 
      shareAndEarnEnabled: checked 
    }));
    // Optional: Add immediate feedback
    toast({
      title: checked ? "Feature Enabled" : "Feature Disabled",
      description: `Share & Earn is now ${checked ? 'active' : 'inactive'}`,
    });
  }} 
  className="data-[state=checked]:bg-accent"
/>
            </div>

            <InputField 
              id="referralBonusAmount" 
              name="referralBonusAmount" 
              label="Referral Bonus Amount (Rs)" 
              type="number" 
              value={settings.referralBonusAmount || 0} 
              onChange={handleInputChange} 
              placeholder="e.g., 10" 
              icon={DollarSign}
              description="Amount awarded to both referrer and referred user upon successful referral."
            />
            <InputField 
              id="shareLinkBaseUrl" 
              name="shareLinkBaseUrl" 
              label="Share Link Base URL" 
              value={settings.shareLinkBaseUrl || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., https://yourapp.com/signup" 
              icon={LinkIconLucide}
              description="The base URL for generating referral links. The user's referral code will be appended (e.g., ?ref=USER_CODE)."
            />
          </div>
        </GlassCard>
        
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Important</AlertTitle>
          <AlertDescription className="!text-primary/80">
            Ensure the "Share Link Base URL" points to your signup page. The system will automatically append `?ref=REFERRAL_CODE_HERE` to this URL.
            The referral bonus is typically awarded when a new user signs up using a valid referral code.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="neon-accent-bg" disabled={isLoading}>
            <Save className="mr-2 h-5 w-5" /> {isLoading ? 'Saving...' : 'Save Share & Earn Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface InputFieldProps {
  id: string;
  name: string; 
  label: string;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  icon?: React.ElementType;
}

const InputField: React.FC<InputFieldProps> = ({ id, name, label, value, onChange, type = "text", placeholder, description, icon: Icon }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium text-muted-foreground flex items-center">
      {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground/80" />}
      {label}
    </Label>
    <Input 
      id={id} 
      name={name} 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      className="bg-input/50 border-border/70 focus:border-accent text-base md:text-sm" 
    />
    {description && <p className="text-xs text-muted-foreground px-1">{description}</p>}
  </div>
);
