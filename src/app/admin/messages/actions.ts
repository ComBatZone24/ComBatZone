
'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getMessaging } from 'firebase-admin/messaging';
import type { GlobalSettings, User } from '@/types';
import { push, serverTimestamp } from 'firebase/database';

/**
 * Sends a push notification to all subscribed users via OneSignal.
 * Includes a fallback to send an in-app broadcast if the push fails due to no subscribers.
 */
export async function sendGlobalNotification(
  heading: string, 
  content: string
): Promise<{ success: boolean; message: string; fallback?: boolean }> {
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
        included_segments: ["All"], 
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
        // Log the message without any prefix
        await adminDb.ref('adminMessages').push({
            text: content,
            timestamp: serverTimestamp(),
        });
        return { success: true, message: `Push notification sent to ${result.recipients || 0} user(s).` };
    } else {
        const errorMessage = result.errors ? result.errors.join(', ') : 'An unknown OneSignal error occurred.';
        if (errorMessage.toLowerCase().includes("all included players are not subscribed")) {
            console.warn("OneSignal Error: No subscribed users found. Sending as in-app broadcast instead.");
            // Send as an in-app broadcast and log it
            await adminDb.ref('adminMessages').push({
                text: content, // Log the original content without prefixes
                timestamp: serverTimestamp(),
            });
            return { 
                success: true,
                fallback: true,
                message: "Push notification failed because no users are currently subscribed. The message has been sent as an In-App Broadcast to all users instead." 
            };
        }
        console.error("OneSignal API Error:", result);
        throw new Error(errorMessage);
    }

  } catch (error: any) {
    console.error("Error sending global push notification:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Sends a direct Firebase Cloud Messaging (FCM) push notification to a specific user.
 */
export async function sendDirectFirebaseNotification(
  userId: string,
  title: string,
  body: string
): Promise<{ success: boolean; message: string }> {
  try {
    const userRef = adminDb.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    if (!snapshot.exists()) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const userData: User = snapshot.val();
    const fcmTokens = userData.fcmTokens ? Object.keys(userData.fcmTokens) : [];

    if (fcmTokens.length === 0) {
      return { success: true, message: "User has no registered devices for push notifications." };
    }

    const message = {
      notification: {
        title,
        body,
      },
      tokens: fcmTokens,
      webpush: {
        fcmOptions: {
          link: '/', // Link to open when notification is clicked
        },
      },
    };

    const response = await getMessaging().sendEachForMulticast(message);

    const successCount = response.successCount;
    const failureCount = response.failureCount;

    if (failureCount > 0) {
        response.responses.forEach(resp => {
            if (!resp.success) {
                console.error(`FCM send error for user ${userId}:`, resp.error);
            }
        });
    }

    return {
      success: true,
      message: `Successfully sent to ${successCount} device(s). Failed for ${failureCount}.`
    };
  } catch (error: any) {
    console.error("Error sending direct FCM notification:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Sends a global Firebase Cloud Messaging (FCM) push notification to all users.
 */
export async function sendGlobalFirebaseNotification(
  title: string,
  body: string
): Promise<{ success: boolean; message: string }> {
  try {
    const usersRef = adminDb.ref('users');
    const snapshot = await usersRef.once('value');
    if (!snapshot.exists()) {
      throw new Error(`No users found in the database.`);
    }

    const allTokens: string[] = [];
    const usersData = snapshot.val();

    for (const userId in usersData) {
      const userData: User = usersData[userId];
      if (userData.fcmTokens) {
        allTokens.push(...Object.keys(userData.fcmTokens));
      }
    }

    if (allTokens.length === 0) {
      return { success: true, message: "No users are subscribed to Firebase push notifications." };
    }
    
    // FCM has a limit of 500 tokens per multicast message
    const tokenChunks = [];
    for (let i = 0; i < allTokens.length; i += 500) {
      tokenChunks.push(allTokens.slice(i, i + 500));
    }

    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (const chunk of tokenChunks) {
      const message = {
        notification: { title, body },
        tokens: chunk,
        webpush: { fcmOptions: { link: '/' } },
      };
      
      const response = await getMessaging().sendEachForMulticast(message);
      totalSuccessCount += response.successCount;
      totalFailureCount += response.failureCount;

      if (response.failureCount > 0) {
        response.responses.forEach(resp => {
            if (!resp.success) {
                console.error(`Global FCM send error:`, resp.error);
            }
        });
      }
    }
    
    // Log the message without any prefix
    await adminDb.ref('adminMessages').push({
        text: body,
        timestamp: serverTimestamp(),
    });

    return {
      success: true,
      message: `Notifications sent to ${totalSuccessCount} devices. Failed for ${totalFailureCount}.`
    };
  } catch (error: any) {
    console.error("Error sending global Firebase notification:", error);
    return { success: false, message: error.message };
  }
}
