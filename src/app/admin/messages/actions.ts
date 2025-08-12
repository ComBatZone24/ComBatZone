
'use server';

import { adminDb } from '@/lib/firebase/admin';
import type { GlobalSettings } from '@/types';

/**
 * Sends a push notification to all subscribed users via OneSignal.
 */
export async function sendGlobalNotification(heading: string, content: string): Promise<{ success: boolean; message: string; }> {
  try {
    if (!adminDb) {
      throw new Error("Firebase Admin SDK is not initialized.");
    }

    const settingsRef = adminDb.ref('globalSettings');
    const snapshot = await settingsRef.once('value');
    if (!snapshot.exists()) {
        throw new Error("Global settings not found in Firebase.");
    }
    const settings: Partial<GlobalSettings> = snapshot.val();
    const appId = settings.onesignalAppId;
    const apiKey = settings.onesignalApiKey;

    if (!appId || !apiKey) {
        throw new Error("OneSignal App ID or API Key is not configured in settings.");
    }

    const notification = {
        app_id: appId,
        included_segments: ["Subscribed Users"],
        headings: { "en": heading },
        contents: { "en": content },
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify(notification),
    });

    const result = await response.json();
    
    if (response.ok && result.id) {
        console.log("OneSignal Notification Sent Successfully:", result.id);
        return { success: true, message: `Push notification sent to ${result.recipients || 0} user(s).` };
    } else {
        console.error("OneSignal API Error:", result);
        const errorMessage = result.errors ? result.errors.join(', ') : 'An unknown OneSignal error occurred.';
        throw new Error(errorMessage);
    }

  } catch (error: any) {
    console.error("Error sending global push notification:", error);
    return { success: false, message: error.message };
  }
}
