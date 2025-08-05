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
    console.error(
      'FATAL: Firebase Admin SDK environment variables are not set. Please check FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your Vercel project settings.'
    );
    // In a real production scenario, you might want to throw an error 
    // to prevent the server from starting in a broken state.
    return;
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
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (e: any) {
    console.error("Failed to initialize Firebase Admin SDK. Please verify your environment variables.", e);
    // We do not throw here to allow the build process to complete, but the error will be logged.
  }
}

// Initialize on module load
initializeFirebaseAdmin();

// Export auth and db instances. They will be undefined if initialization failed.
let adminAuth;
let adminDb;

try {
  adminAuth = getAuth();
  adminDb = getDatabase();
} catch (e) {
  console.error("Could not get Firebase Admin auth or database instances. The SDK might not have been initialized correctly.");
}

export { adminAuth, adminDb };
export default admin;
