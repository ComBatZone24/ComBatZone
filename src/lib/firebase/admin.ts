import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getApps } from 'firebase-admin/app';

// This file is for SERVER-SIDE use only.

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return; // Already initialized
  }
  
  // Using individual environment variables for robustness
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Important: Replace \\n with \n
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      'FATAL: Firebase Admin SDK environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL) are not set correctly.'
    );
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    console.log("Firebase Admin SDK initialized successfully using individual env vars.");
  } catch (e: any) {
    console.error("Failed to initialize Firebase Admin with individual env vars:", e);
    throw new Error("Could not initialize Firebase Admin SDK. Check your environment variables.");
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export const adminAuth = getAuth();
export const adminDb = getDatabase();
export default admin;
