"use client";

import { useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase/config'; 
const FirebaseInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    if (!getApps().length) {
      // This is a check to see if Firebase is already initialized.
      // The actual initialization logic is in @/lib/firebase/config.ts
      // to ensure it runs as early as possible.
    }
    
    // Register Service Worker for PWA functionality
    // This is wrapped in a 'load' event listener to avoid contention with the main app loading.
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
          .catch((error) => console.error('Service Worker registration failed:', error));
      });
    }

  }, []);

  return <>{children}</>;
};

export default FirebaseInitializer;
