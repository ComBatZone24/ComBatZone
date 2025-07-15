
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2 as LinkIconLucide, Save, Loader2, ArrowLeft, MessageSquare, Mail, Facebook, Instagram, Youtube, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GlobalSettings } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';

// Define the shape of settings specifically for this page
interface ContactSettings {
  contactWhatsapp: string;
  contactEmail: string;
  socialMediaFacebook: string;
  socialMediaInstagram: string;
  socialMediaYoutube: string;
}

const initialContactSettings: ContactSettings = {
  contactWhatsapp: '',
  contactEmail: '',
  socialMediaFacebook: '',
  socialMediaInstagram: '',
  socialMediaYoutube: '',
};

export default function AdminContactSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ContactSettings>(initialContactSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsFetchingSettings(false);
        setSettings(initialContactSettings);
        return;
      }
      setIsFetchingSettings(true);
      try {
        const globalSettingsRef = ref(database, 'globalSettings');
        const snapshot = await get(globalSettingsRef);
        
        if (snapshot.exists()) {
          const fetchedGlobalSettings = snapshot.val() as Partial<GlobalSettings>;
          setSettings({
            contactWhatsapp: fetchedGlobalSettings.contactWhatsapp || initialContactSettings.contactWhatsapp,
            contactEmail: fetchedGlobalSettings.contactEmail || initialContactSettings.contactEmail,
            socialMediaFacebook: fetchedGlobalSettings.socialMediaFacebook || initialContactSettings.socialMediaFacebook,
            socialMediaInstagram: fetchedGlobalSettings.socialMediaInstagram || initialContactSettings.socialMediaInstagram,
            socialMediaYoutube: fetchedGlobalSettings.socialMediaYoutube || initialContactSettings.socialMediaYoutube,
          });
        } else {
          setSettings(initialContactSettings);
          toast({ title: "Defaults Loaded", description: "Contact settings not found, using defaults. Save to create.", variant: "default" });
        }
      } catch (error) {
        console.error("Error fetching contact settings:", error);
        toast({ title: "Settings Error", description: "Could not load contact settings from Firebase.", variant: "destructive" });
        setSettings(initialContactSettings);
      } finally {
        setIsFetchingSettings(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmitSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized. Cannot save settings.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      // Construct only the fields relevant to this page for update
      const settingsToUpdate: Partial<GlobalSettings> = {
        contactWhatsapp: settings.contactWhatsapp,
        contactEmail: settings.contactEmail,
        socialMediaFacebook: settings.socialMediaFacebook,
        socialMediaInstagram: settings.socialMediaInstagram,
        socialMediaYoutube: settings.socialMediaYoutube,
        updatedAt: serverTimestamp() 
      };

      await update(ref(database, 'globalSettings'), settingsToUpdate);
      
      toast({
        title: "Contact Links Saved",
        description: "Your public contact and social media links have been updated.",
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error) {
        console.error("Error saving contact settings:", error);
        toast({ title: "Save Error", description: "Could not save settings. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  if (isFetchingSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Contact Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <LinkIconLucide className="mr-3 h-8 w-8 text-accent"/> Contact & Social Links
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmitSettings} className="space-y-8">
        <GlassCard>
          <h3 className="text-xl font-semibold text-foreground mb-1">Platform Contact Details</h3>
          <p className="text-sm text-muted-foreground mb-4">Enter URLs for users to contact or follow you. Leave blank if not applicable.</p>
          <Separator className="mb-6 bg-border/30" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField 
              id="contactWhatsapp" 
              name="contactWhatsapp" 
              label="WhatsApp Link" 
              value={settings.contactWhatsapp || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., https://wa.me/1234567890" 
              icon={MessageSquare}
              description="Full WhatsApp link including https://"
            />
            <InputField 
              id="contactEmail" 
              name="contactEmail" 
              label="Email Address (mailto link)" 
              value={settings.contactEmail || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., mailto:support@example.com" 
              icon={Mail}
              description="Use mailto: prefix for direct email client link"
            />
            <InputField 
              id="socialMediaFacebook" 
              name="socialMediaFacebook" 
              label="Facebook Page URL" 
              value={settings.socialMediaFacebook || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., https://facebook.com/yourpage" 
              icon={Facebook}
            />
            <InputField 
              id="socialMediaInstagram" 
              name="socialMediaInstagram" 
              label="Instagram Profile URL" 
              value={settings.socialMediaInstagram || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., https://instagram.com/yourprofile" 
              icon={Instagram}
            />
            <InputField 
              id="socialMediaYoutube" 
              name="socialMediaYoutube" 
              label="YouTube Channel URL" 
              value={settings.socialMediaYoutube || ''} 
              onChange={handleInputChange} 
              placeholder="e.g., https://youtube.com/yourchannel" 
              icon={Youtube}
            />
          </div>
        </GlassCard>
        
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Visibility</AlertTitle>
          <AlertDescription className="!text-primary/80">
            These links, if provided, will be visible to users on the homepage and their profile page.
            Ensure URLs are correct and start with https:// (or mailto: for email).
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="neon-accent-bg" disabled={isLoading}>
            <Save className="mr-2 h-5 w-5" /> {isLoading ? 'Saving...' : 'Save Contact Links'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Helper component for input fields
interface InputFieldProps {
  id: string;
  name: keyof ContactSettings; // Ensure name is a key of ContactSettings
  label: string;
  value: string;
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

