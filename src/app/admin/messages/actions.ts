
'use server';

import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import type { GlobalSettings } from '@/types';

/**
 * Sends a push notification to all subscribed users.
 * This function is now a placeholder after removing OneSignal. It will log an action but not send a push notification.
 * It will always return success to not break the UI flow, but the real notification system is now in-app only.
 */
export async function sendGlobalNotification(heading: string, content: string): Promise<{ success: boolean; message: string; }> {
  try {
    if (!database) {
      throw new Error("Firebase is not initialized.");
    }
    
    // This function no longer sends a push notification.
    // It will return a success message to indicate the broadcast was logged.
    // The actual "notification" is the message appearing in the user's notification list in-app.

    console.log(`BROADCAST LOGGED (No push sent): Heading: "${heading}", Content: "${content}"`);

    return { success: true, message: `Broadcast message logged successfully.` };

  } catch (error: any) {
    console.error("Error during global notification logging:", error);
    return { success: false, message: error.message };
  }
}
