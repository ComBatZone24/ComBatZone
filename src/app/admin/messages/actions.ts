
'use server';

import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import type { GlobalSettings } from '@/types';

/**
 * Sends a push notification to all subscribed users via OneSignal.
 * This is a secure server-side action and should not expose API keys to the client.
 */
export async function sendGlobalNotification(heading: string, content: string): Promise<{ success: boolean; message: string; }> {
  try {
    if (!database) {
      throw new Error("Firebase is not initialized.");
    }
    
    // Fetch OneSignal credentials securely from the database.
    const settingsRef = ref(database, 'globalSettings');
    const snapshot = await get(settingsRef);

    if (!snapshot.exists()) {
      throw new Error("Global settings not found in the database.");
    }
    
    const settings: Partial<GlobalSettings> = snapshot.val();
    const appId = settings.onesignalAppId;
    const apiKey = settings.onesignalApiKey;

    if (!appId || !apiKey) {
      throw new Error("OneSignal App ID or API Key is not configured in admin settings.");
    }

    const notification = {
      app_id: appId,
      headings: { "en": heading },
      contents: { "en": content },
      included_segments: ["Subscribed Users"] // Targets all users who have opted-in
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(notification),
    });

    const responseData = await response.json();

    if (response.ok) {
        if (responseData.errors?.invalid_player_ids?.length > 0) {
            return { success: false, message: `OneSignal API Error: ${responseData.errors.invalid_player_ids[0]}` };
        }
        if (responseData.errors) {
             const errorMessage = Array.isArray(responseData.errors) ? responseData.errors[0] : JSON.stringify(responseData.errors);
             if (typeof errorMessage === 'string' && errorMessage.includes("All included players are not subscribed")) {
                 return { success: false, message: "Notification not sent: No users are currently subscribed to receive notifications." };
             }
             return { success: false, message: `OneSignal API Error: ${errorMessage}` };
        }
        return { success: true, message: `Notification sent successfully. Recipients: ${responseData.recipients || 0}` };
    } else {
        const errorText = responseData.errors ? JSON.stringify(responseData.errors) : `OneSignal API request failed with status ${response.status}`;
        return { success: false, message: errorText };
    }

  } catch (error: any) {
    console.error("OneSignal send error:", error);
    return { success: false, message: error.message };
  }
}
