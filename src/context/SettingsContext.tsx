"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue } from 'firebase/database';
import type { GlobalSettings } from '@/types';

interface SettingsContextType {
  settings: Partial<GlobalSettings> | null;
  isLoadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Partial<GlobalSettings> | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    if (!database) {
      console.warn("SettingsContext: Firebase not available. Using empty settings.");
      setIsLoadingSettings(false);
      return;
    }

    const settingsRef = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      setSettings(snapshot.exists() ? snapshot.val() : {});
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("Error fetching global settings in context:", error);
      setSettings({});
      setIsLoadingSettings(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoadingSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
