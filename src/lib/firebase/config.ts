
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// --- Client-side Firebase Config ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCwbQE1CDTL90JaPOVPZsZd6xHtnuBf0Wo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "arena-ace-mhsy7.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://arena-ace-mhsy7-default-rtdb.firebaseio.com/",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "arena-ace-mhsy7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "arena-ace-mhsy7.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "872680187970",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let database: Database | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

// --- Client-side App Initialization ---
// This code only runs on the client.
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log('Firebase client app initialized successfully.');
  } catch (error) {
    console.error('Firebase client initializeApp() FAILED:', error);
    app = {} as FirebaseApp;
  }
} else if (typeof window !== 'undefined') {
  app = getApp();
}

// Initialize client services only if app was properly initialized
if (typeof window !== 'undefined' && app && app.options && app.options.projectId) {
  try {
    database = getDatabase(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Error initializing Firebase client services:', error);
  }
} else if (typeof window !== 'undefined') {
  console.warn('Firebase client app object is not properly initialized. Services will NOT be available.');
}

// NOTE: Firebase Admin SDK initialization is now in a separate file: /lib/firebase/admin.ts
// This prevents server-only code from being bundled with the client.

export { app, database, auth, storage };
