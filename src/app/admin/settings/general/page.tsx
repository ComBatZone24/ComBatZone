
"use client"; 

import { useState, useEffect } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Settings as SettingsIcon, AlertCircle, Loader2, ArrowLeft, Zap, DollarSign, MessageCircle, FileImage, Cpu, Handshake, ShoppingCart, ListChecks, Wand2, Tv, Link as LinkIconLucide, MousePointerClick } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GlobalSettings, StepAndEarnSettings } from '@/types';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, update, get, serverTimestamp } from 'firebase/database';
import RupeeIcon from '@/components/core/rupee-icon';
import { Textarea } from '@/components/ui/textarea';


const initialGeneralSettings: {
  registrationEnabled: boolean;
  limitRegistrationsEnabled: boolean; 
  maxRegistrations: number | null;
  globalChatEnabled: boolean;
  clickAndEarnEnabled: boolean; // Added this new setting
  feyorraLogoUrl: string;
  rollerCoinTaskEnabled: boolean;
  feyorraTaskEnabled: boolean;
  mobileLoadEnabled: boolean;
  shopEnabled: boolean;
  timebucksTaskSettings: { enabled: boolean; referralUrl: string; };
  customTaskCardSettings: { enabled: boolean; imageUrl: string; title: string; description: string; buttonText: string; buttonLink: string; };
  feyorraReferralUrl?: string;
  rollerCoinReferralUrl?: string;
  onesignalAppId?: string;
  onesignalApiKey?: string;
} = {
  registrationEnabled: true,
  limitRegistrationsEnabled: false,
  maxRegistrations: 1000,
  globalChatEnabled: true,
  clickAndEarnEnabled: true, // Default to true
  feyorraLogoUrl: '',
  rollerCoinTaskEnabled: true,
  feyorraTaskEnabled: true,
  mobileLoadEnabled: true,
  shopEnabled: true,
  timebucksTaskSettings: {
    enabled: true,
    referralUrl: 'https://timebucks.com/?ref=YOUR_REF_ID',
  },
  customTaskCardSettings: {
      enabled: true,
      imageUrl: 'https://placehold.co/600x300.png?text=Custom+Task',
      title: 'Complete Special Task',
      description: 'Engage with our new partner task to earn exclusive rewards and bonuses directly to your wallet.',
      buttonText: 'Start Task Now',
      buttonLink: '#',
  },
  rollerCoinReferralUrl: "https://rollercoin.com/?r=YOUR_REF_ID",
  feyorraReferralUrl: "https://faucetpay.io/?r=YOUR_REF_ID",
  onesignalAppId: "",
  onesignalApiKey: "",
};

export default function AdminGeneralSettingsPage() {
  const { toast } = useToast();
  const [generalSettings, setGeneralSettings] = useState(initialGeneralSettings);
  const [isLoading, setIsLoading] = useState(false); 
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsFetchingSettings(false);
        setGeneralSettings(initialGeneralSettings);
        return;
      }
      setIsFetchingSettings(true);
      try {
        const globalSettingsRef = ref(database, 'globalSettings');
        const globalSnapshot = await get(globalSettingsRef);

        if (globalSnapshot.exists()) {
          const fetchedGlobalSettings = globalSnapshot.val() as Partial<GlobalSettings>;
          setGeneralSettings({
            registrationEnabled: fetchedGlobalSettings.registrationEnabled ?? initialGeneralSettings.registrationEnabled,
            limitRegistrationsEnabled: fetchedGlobalSettings.limitRegistrationsEnabled ?? initialGeneralSettings.limitRegistrationsEnabled,
            maxRegistrations: fetchedGlobalSettings.maxRegistrations ?? initialGeneralSettings.maxRegistrations,
            globalChatEnabled: fetchedGlobalSettings.globalChatEnabled ?? initialGeneralSettings.globalChatEnabled,
            clickAndEarnEnabled: fetchedGlobalSettings.clickAndEarnEnabled ?? initialGeneralSettings.clickAndEarnEnabled,
            feyorraLogoUrl: fetchedGlobalSettings.feyorraLogoUrl || initialGeneralSettings.feyorraLogoUrl,
            rollerCoinTaskEnabled: fetchedGlobalSettings.rollerCoinTaskEnabled ?? initialGeneralSettings.rollerCoinTaskEnabled,
            feyorraTaskEnabled: fetchedGlobalSettings.feyorraTaskEnabled ?? initialGeneralSettings.feyorraTaskEnabled,
            mobileLoadEnabled: fetchedGlobalSettings.mobileLoadEnabled ?? initialGeneralSettings.mobileLoadEnabled,
            shopEnabled: fetchedGlobalSettings.shopEnabled ?? initialGeneralSettings.shopEnabled,
            timebucksTaskSettings: {
                ...initialGeneralSettings.timebucksTaskSettings,
                ...(fetchedGlobalSettings.timebucksTaskSettings || {}),
            },
            customTaskCardSettings: {
                ...initialGeneralSettings.customTaskCardSettings,
                ...(fetchedGlobalSettings.customTaskCardSettings || {}),
            },
            rollerCoinReferralUrl: fetchedGlobalSettings.rollerCoinReferralUrl || initialGeneralSettings.rollerCoinReferralUrl,
            feyorraReferralUrl: fetchedGlobalSettings.feyorraReferralUrl || initialGeneralSettings.feyorraReferralUrl,
            onesignalAppId: fetchedGlobalSettings.onesignalAppId || initialGeneralSettings.onesignalAppId,
            onesignalApiKey: fetchedGlobalSettings.onesignalApiKey || initialGeneralSettings.onesignalApiKey,
          });
        } else {
          setGeneralSettings(initialGeneralSettings);
          toast({ title: "Defaults Loaded", description: "Global settings node not found, using default general settings. Save to create.", variant: "default" });
        }
      } catch (error) {
        console.error('Error fetching general settings:', error);
        toast({ title: 'Settings Error', description: 'Could not load general settings from Firebase.', variant: 'destructive' });
        setGeneralSettings(initialGeneralSettings); 
      } finally {
        setIsFetchingSettings(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleInputChange = (
    key: keyof typeof generalSettings | `timebucksTaskSettings.${keyof GlobalSettings['timebucksTaskSettings']}` | `customTaskCardSettings.${keyof GlobalSettings['customTaskCardSettings']}`,
    value: boolean | number | string | null
  ) => {
    setGeneralSettings((prev) => {
      const keys = key.split('.');
      if (keys.length > 1) {
        const [mainKey, subKey] = keys as [keyof typeof generalSettings, string];
        return {
          ...prev,
          [mainKey]: {
            // @ts-ignore
            ...prev[mainKey],
            [subKey]: value
          }
        }
      }
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleTaskCardSettingChange = (
    key: keyof NonNullable<GlobalSettings['customTaskCardSettings']>,
    value: boolean | string
  ) => {
     setGeneralSettings(prev => ({
        ...prev,
        customTaskCardSettings: {
            ...prev.customTaskCardSettings,
            [key]: value,
        }
     }))
  }

  const handleSubmitSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!database) {
      toast({ title: 'Firebase Error', description: 'Database not initialized. Cannot save settings.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const settingsToUpdate: Partial<GlobalSettings> = {
        registrationEnabled: generalSettings.registrationEnabled,
        limitRegistrationsEnabled: generalSettings.limitRegistrationsEnabled,
        maxRegistrations: generalSettings.limitRegistrationsEnabled ? (Number(generalSettings.maxRegistrations) || null) : null,
        globalChatEnabled: generalSettings.globalChatEnabled,
        clickAndEarnEnabled: generalSettings.clickAndEarnEnabled,
        feyorraLogoUrl: generalSettings.feyorraLogoUrl || null,
        rollerCoinTaskEnabled: generalSettings.rollerCoinTaskEnabled,
        feyorraTaskEnabled: generalSettings.feyorraTaskEnabled,
        mobileLoadEnabled: generalSettings.mobileLoadEnabled,
        shopEnabled: generalSettings.shopEnabled,
        timebucksTaskSettings: generalSettings.timebucksTaskSettings,
        customTaskCardSettings: generalSettings.customTaskCardSettings,
        rollerCoinReferralUrl: generalSettings.rollerCoinReferralUrl,
        feyorraReferralUrl: generalSettings.feyorraReferralUrl,
        onesignalAppId: generalSettings.onesignalAppId,
        onesignalApiKey: generalSettings.onesignalApiKey,
        updatedAt: serverTimestamp() 
      };

      if (settingsToUpdate.limitRegistrationsEnabled && (settingsToUpdate.maxRegistrations === null || settingsToUpdate.maxRegistrations <= 0 || !Number.isInteger(settingsToUpdate.maxRegistrations))) {
        toast({ title: 'Validation Error', description: 'Maximum registrations must be a positive whole number when the limit is enabled.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      await update(ref(database, 'globalSettings'), settingsToUpdate);

      toast({
        title: 'General Settings Saved',
        description: 'General platform settings have been updated.',
        variant: 'default',
        className: 'bg-green-500/20 text-green-300 border-green-500/30',
      });
    } catch (error) {
      console.error('Error saving general settings to Firebase:', error);
      toast({ title: 'Save Error', description: 'Could not save general settings. ' + (error instanceof Error ? error.message : ''), variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  if (isFetchingSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading General Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <SettingsIcon className="mr-3 h-8 w-8 text-accent" /> General Platform Settings
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmitSettings} className="space-y-8">
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Push Notifications (OneSignal)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your OneSignal credentials to send push notifications to users.
            </p>
            <Separator className="mb-6 bg-border/30" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                 <InputField
                    id="onesignalAppId"
                    label="OneSignal App ID"
                    value={generalSettings.onesignalAppId || ''}
                    onChange={(e) => handleInputChange('onesignalAppId', e.target.value)}
                    placeholder="Enter your OneSignal App ID"
                />
                 <InputField
                    id="onesignalApiKey"
                    label="REST API Key"
                    value={generalSettings.onesignalApiKey || ''}
                    onChange={(e) => handleInputChange('onesignalApiKey', e.target.value)}
                    placeholder="Enter your OneSignal REST API Key"
                    type="password"
                />
            </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-xl font-semibold text-foreground mb-1">Feature Toggles</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Control core features of the platform.
          </p>
          <Separator className="mb-6 bg-border/30" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <SwitchField 
              id="registrationEnabled"
              label="New User Registrations"
              checked={generalSettings.registrationEnabled}
              onCheckedChange={(val) => handleInputChange('registrationEnabled', val)}
              description="Allow new users to sign up for the platform."
            />
             <SwitchField 
              id="globalChatEnabled"
              label="Global Chat"
              checked={generalSettings.globalChatEnabled}
              onCheckedChange={(val) => handleInputChange('globalChatEnabled', val)}
              description="Enable or disable the community global chat feature."
            />
             <SwitchField 
              id="clickAndEarnEnabled"
              label="Click &amp; Earn"
              checked={generalSettings.clickAndEarnEnabled}
              onCheckedChange={(val) => handleInputChange('clickAndEarnEnabled', val)}
              description="Enable or disable the 'Click &amp; Earn' section."
            />
             <SwitchField 
              id="mobileLoadEnabled"
              label="Mobile Load Feature"
              checked={generalSettings.mobileLoadEnabled}
              onCheckedChange={(val) => handleInputChange('mobileLoadEnabled', val)}
              description="Allow users to request mobile loads from their wallet."
            />
             <SwitchField 
              id="shopEnabled"
              label="Shop Feature"
              checked={generalSettings.shopEnabled}
              onCheckedChange={(val) => handleInputChange('shopEnabled', val)}
              description="Enable or disable the entire product shop."
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-xl font-semibold text-foreground mb-1">Maximum Registrations</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Set a maximum number of users that can register on the platform.
          </p>
          <Separator className="mb-6 bg-border/30" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 items-center">
            <div className="space-y-2">
              <SwitchField
                id="limitRegistrationsEnabled"
                label="Enable Registration Limit"
                checked={generalSettings.limitRegistrationsEnabled}
                onCheckedChange={(val) =>
                  handleInputChange('limitRegistrationsEnabled', val)
                }
                description="Enable this to set a maximum number of user registrations."
              />
            </div>
            {generalSettings.limitRegistrationsEnabled && (
                <div className="space-y-2 opacity-100 transition-opacity duration-200">
                    <Label htmlFor="maxRegistrations" className="text-md font-medium text-foreground">Registration Limit</Label>
                    <Input
                        id="maxRegistrations"
                        type="number"
                        value={
                          generalSettings.maxRegistrations === null ? '' : generalSettings.maxRegistrations}
                        onChange={(e) => {
                           const value = parseInt(e.target.value, 10);
                           handleInputChange('maxRegistrations', isNaN(value) ? null : value);
                        }}
                        min="1"
                        className="bg-background/30 border-border/30"
                    />
                     <p className="text-xs text-muted-foreground px-1">Once this limit is reached, new registrations will be disabled.</p>
                </div>
            )}
          </div>
        </GlassCard>
        
         <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Task Page Customization</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Control the visibility and links for third-party earning tasks.
            </p>
            <Separator className="mb-6 bg-border/30" />
            <div className="space-y-6">
                
                <SwitchField 
                    id="feyorraTaskEnabled"
                    label="Feyorra Tasks"
                    checked={generalSettings.feyorraTaskEnabled}
                    onCheckedChange={(val) => handleInputChange('feyorraTaskEnabled', val)}
                    description="Enable or disable the Feyorra tasks section on the Earn Tasks page."
                    icon={Handshake}
                />
                 <InputField
                    id="feyorraLogoUrl"
                    label="Feyorra Tasks Logo URL"
                    value={generalSettings.feyorraLogoUrl}
                    onChange={(e) => handleInputChange('feyorraLogoUrl', e.target.value)}
                    placeholder="e.g., https://.../logo.png"
                    icon={FileImage}
                    description="Logo displayed for the Feyorra Tasks section. Leave blank for default."
                />
                 <InputField
                    id="feyorraReferralUrl"
                    label="Feyorra/FaucetPay Referral URL"
                    value={generalSettings.feyorraReferralUrl || ''}
                    onChange={(e) => handleInputChange('feyorraReferralUrl', e.target.value)}
                    placeholder="https://faucetpay.io/?r=YOUR_ID"
                    icon={LinkIconLucide}
                />
                
                <Separator className="my-2 bg-border/50" />
                
                <SwitchField 
                    id="timebucksTaskEnabled"
                    label="TimeBucks Task"
                    checked={generalSettings.timebucksTaskSettings.enabled}
                    onCheckedChange={(val) => handleInputChange('timebucksTaskSettings', {...generalSettings.timebucksTaskSettings, enabled: val})}
                    description="Enable or disable the TimeBucks task on the Earn Tasks page."
                    icon={ListChecks}
                />
                 <InputField
                    id="timebucksReferralUrl"
                    label="TimeBucks Referral URL"
                    value={generalSettings.timebucksTaskSettings.referralUrl}
                    onChange={(e) => handleInputChange('timebucksTaskSettings', {...generalSettings.timebucksTaskSettings, referralUrl: e.target.value})}
                    placeholder="https://timebucks.com/?ref=YOUR_ID"
                    icon={LinkIconLucide}
                    description="Your personal referral link for the TimeBucks task."
                />

                <Separator className="my-2 bg-border/50" />

                <SwitchField 
                    id="customTaskEnabled"
                    label="Custom Task Card"
                    checked={generalSettings.customTaskCardSettings.enabled}
                    onCheckedChange={(val) => handleTaskCardSettingChange('enabled', val)}
                    description="Display a fully editable promotional card on the Earn Tasks page."
                    icon={Wand2}
                />
                <div className="space-y-4 pl-4 border-l-2 border-border/50">
                    <InputField id="customTaskImageUrl" label="Image URL" value={generalSettings.customTaskCardSettings.imageUrl} onChange={(e) => handleTaskCardSettingChange('imageUrl', e.target.value)} icon={FileImage} placeholder="https://..."/>
                    <InputField id="customTaskTitle" label="Title" value={generalSettings.customTaskCardSettings.title} onChange={(e) => handleTaskCardSettingChange('title', e.target.value)} placeholder="Card Title"/>
                    <div className="space-y-2">
                         <Label htmlFor="customTaskDescription" className="text-sm font-medium text-muted-foreground flex items-center">Description</Label>
                        <Textarea id="customTaskDescription" value={generalSettings.customTaskCardSettings.description} onChange={(e) => handleTaskCardSettingChange('description', e.target.value)} placeholder="Card Description" className="bg-input/50"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField id="customTaskButtonText" label="Button Text" value={generalSettings.customTaskCardSettings.buttonText} onChange={(e) => handleTaskCardSettingChange('buttonText', e.target.value)} placeholder="e.g., Start Now"/>
                        <InputField id="customTaskButtonLink" label="Button Link" value={generalSettings.customTaskCardSettings.buttonLink} onChange={(e) => handleTaskCardSettingChange('buttonLink', e.target.value)} placeholder="https://..."/>
                    </div>
                </div>


            </div>
         </GlassCard>
        
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Important Note</AlertTitle>
          <AlertDescription className="!text-primary/80">
            These settings affect core platform functionalities. Ensure you understand the impact before saving changes.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" className="neon-accent-bg" disabled={isLoading}>
            <Save className="mr-2 h-5 w-5" /> {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );

}

interface SwitchFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ElementType;
  description?: string;
}

const SwitchField: React.FC<SwitchFieldProps> = ({ id, label, checked, onCheckedChange, icon: Icon, description }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between space-x-2 bg-background/30 p-3 rounded-md border border-border/30">
      <Label htmlFor={id} className="flex items-center text-md font-medium text-foreground cursor-pointer">
        {Icon && <Icon className="mr-2 h-5 w-5 text-accent" />}
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-accent" />
    </div>
    {description && <p className="text-xs text-muted-foreground px-1">{description}</p>}
  </div>
);

interface InputFieldProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  icon?: React.ElementType;
  step?: string;
  min?: string;
}

const InputField: React.FC<InputFieldProps> = ({ id, label, value, onChange, type = "text", placeholder, description, icon: Icon, step, min }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium text-muted-foreground flex items-center">
      {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground/80" />}
      {label}
    </Label>
    <Input 
      id={id} 
      name={id} 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      className="bg-input/50 border-border/70 focus:border-accent" 
      step={step}
      min={min}
    />
    {description && <p className="text-xs text-muted-foreground px-1">{description}</p>}
  </div>
);

