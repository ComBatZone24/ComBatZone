
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { AdsterraSettings } from '@/types';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define the shape of the context
interface AdContextType {
  settings: AdsterraSettings | null;
  triggerButtonAd: (callback: () => void, placementId: string) => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

// Define default settings to prevent errors if Firebase is slow or fails
const defaultAdSettings: AdsterraSettings = {
  enabled: false,
  directLinks: [],
  popupsEnabled: false,
  popupMinInterval: 5,
  popupMaxInterval: 10,
  buttonAdPlacements: {},
};

// The provider component
export const AdProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AdsterraSettings | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const { toast } = useToast();

  // Fetch settings from Firebase
  useEffect(() => {
    if (!database) {
      console.warn("AdProvider: Firebase not initialized. Ads will be disabled.");
      setSettings(defaultAdSettings);
      return;
    }
    const settingsRef = ref(database, 'globalSettings/adsterraSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data: AdsterraSettings = snapshot.val();
        // Ensure directLinks is always an array
        const sanitizedData = { ...defaultAdSettings, ...data, directLinks: data.directLinks || [] };
        setSettings(sanitizedData);
      } else {
        setSettings(defaultAdSettings);
      }
    });
    return () => unsubscribe();
  }, []);

  // Logic for random popups
  useEffect(() => {
    if (!settings || !settings.enabled || !settings.popupsEnabled || !settings.directLinks || settings.directLinks.length === 0) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    
    const scheduleNextAd = () => {
      const min = settings.popupMinInterval * 60 * 1000;
      const max = settings.popupMaxInterval * 60 * 1000;
      const randomInterval = Math.floor(Math.random() * (max - min + 1)) + min;

      timeoutId = setTimeout(() => {
        setIsPopupVisible(true);
      }, randomInterval);
    };

    scheduleNextAd();

    return () => clearTimeout(timeoutId);
  }, [settings, isPopupVisible]);

  const triggerButtonAd = useCallback((callback: () => void, placementId: string) => {
    // Check if the whole ad system is off, or no links exist
    if (!settings || !settings.enabled || !settings.directLinks || settings.directLinks.length === 0) {
      callback();
      return;
    }
    
    // Check if this specific placement is enabled
    const isPlacementEnabled = settings.buttonAdPlacements?.[placementId] === true;
    
    if (!isPlacementEnabled) {
        callback();
        return;
    }
    
    const randomLink = settings.directLinks[Math.floor(Math.random() * settings.directLinks.length)];
    
    const adWindow = window.open(randomLink, '_blank');

    if (!adWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please disable your popup blocker to proceed.",
        variant: "destructive",
      });
      return; // Stop the action if popup is blocked
    }
    
    // Instead of waiting for it to close, we assume the user will handle it and continue the app action.
    callback();

  }, [settings, toast]);
  
  const handleClosePopup = () => {
    setIsPopupVisible(false);
  }

  const value = { settings, triggerButtonAd };

  return (
    <AdContext.Provider value={value}>
      {children}
      {isPopupVisible && settings && settings.directLinks && settings.directLinks.length > 0 && (
        <FullScreenAd 
          links={settings.directLinks} 
          onClose={handleClosePopup}
        />
      )}
    </AdContext.Provider>
  );
};

// Custom hook to use the context
export const useAd = () => {
  const context = useContext(AdContext);
  if (context === undefined) {
    throw new Error('useAd must be used within an AdProvider');
  }
  return context;
};


// NEW FullScreenAd Component
interface FullScreenAdProps {
    links: string[];
    onClose: () => void;
}

const FullScreenAd: React.FC<FullScreenAdProps> = ({ links, onClose }) => {
    const [adUrl] = useState(() => links[Math.floor(Math.random() * links.length)]);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleAdClick = () => {
        window.open(adUrl, '_blank', 'noopener,noreferrer');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-background border-2 border-accent/50 shadow-2xl rounded-lg flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-2xl font-bold text-accent">Advertisement</h2>
                <p className="text-muted-foreground mt-2">You will be redirected to one of our sponsor's pages.</p>
                <Button onClick={handleAdClick} className="mt-8 text-lg py-6 px-12 neon-accent-bg">
                    Click here to continue
                </Button>
                <button
                    onClick={onClose}
                    disabled={countdown > 0}
                    className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Close Ad"
                >
                    {countdown > 0 ? countdown : <X className="h-5 w-5"/>}
                </button>
            </div>
        </div>
    )
}
