
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue } from 'firebase/database';
import type { AppUpdateSettings } from '@/types';
import UpdateDialog from '@/components/core/UpdateDialog';

declare global {
  interface Window {
    median: any;
  }
}

interface UpdateContextType {
  isUpdateRequired: boolean;
  updateInfo: AppUpdateSettings | null;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateSettings | null>(null);

  const checkForUpdate = useCallback(async () => {
    // This logic should only run inside a Median.co wrapped app
    if (typeof window === 'undefined' || !window.median?.app?.version) {
      return;
    }

    try {
      const currentVersionCode = parseInt(window.median.app.version.code, 10);
      if (isNaN(currentVersionCode)) return;

      const settingsRef = ref(database, 'globalSettings/appUpdate');
      onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          const settings: AppUpdateSettings = snapshot.val();
          setUpdateInfo(settings);
          // The main logic: show the dialog if an update is available AND forceUpdate is true.
          if (settings.forceUpdate && settings.latestVersionCode > currentVersionCode) {
            setIsUpdateRequired(true);
          } else {
            setIsUpdateRequired(false);
          }
        }
      }, { onlyOnce: true }); // Fetch only once per session
    } catch (error) {
      console.error("Failed to check for app updates:", error);
    }
  }, []);

  useEffect(() => {
    // Add a delay to ensure median object is available
    const timeoutId = setTimeout(() => {
        checkForUpdate();
    }, 3000); 

    return () => clearTimeout(timeoutId);
  }, [checkForUpdate]);

  return (
    <UpdateContext.Provider value={{ isUpdateRequired, updateInfo }}>
      {children}
      {isUpdateRequired && updateInfo && <UpdateDialog updateInfo={updateInfo} />}
    </UpdateContext.Provider>
  );
};

export const useUpdate = () => {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
};
