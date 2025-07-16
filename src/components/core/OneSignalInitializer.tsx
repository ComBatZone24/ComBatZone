
"use client";

import { useEffect } from 'react';
import Script from 'next/script';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';

export default function OneSignalInitializer() {
  const { settings, isLoadingSettings } = useSettings();
  const { user } = useAuth();

  const appId = settings?.onesignalAppId;

  useEffect(() => {
    if (isLoadingSettings || !appId) {
      return;
    }

    window.OneSignal = window.OneSignal || [];
    const OneSignal = window.OneSignal;

    OneSignal.push(() => {
      OneSignal.init({
        appId: appId,
        safari_web_id: "YOUR_SAFARI_WEB_ID", // Optional
        allowLocalhostAsSecureOrigin: true, // Useful for development
        autoRegister: true, // Automatically prompt for notification permission
        notifyButton: {
            enable: false, // We use our own UI, so disable the default bell
        },
      });
    });

    // If user logs in, set their external user ID in OneSignal using the new login method
    if (user?.id) {
        OneSignal.push(() => {
            OneSignal.login(user.id);
            // You can also set tags here using the new method for SDK v16
            OneSignal.User.addTag("user_role", user.role || 'user');
        });
    } else {
        // If user logs out, logout from OneSignal as well
        OneSignal.push(() => {
            OneSignal.logout();
        });
    }

    // Cleanup on component unmount
    return () => {
        // You could add cleanup logic here if needed, but usually not necessary
        // as OneSignal manages its own lifecycle.
    };
  }, [appId, isLoadingSettings, user]);

  return (
    <Script
      id="onesignal-sdk"
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
      async
    />
  );
}

declare global {
  interface Window {
    OneSignal: any[];
  }
}
