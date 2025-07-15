
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// These are FALLBACK values.
// It is STRONGLY recommended to use environment variables for Firebase configuration.
// Ensure all NEXT_PUBLIC_FIREBASE_* variables are set in your .env.local file.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCwbQE1CDTL90JaPOVPZsZd6xHtnuBf0Wo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "arena-ace-mhsy7.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://arena-ace-mhsy7-default-rtdb.firebaseio.com/",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "arena-ace-mhsy7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "arena-ace-mhsy7.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "872680187970",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID, // CRITICAL: This MUST be your WEB App ID set in .env.local
};

let app: FirebaseApp;
let database: Database | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// This isomorphic check works on both client and server.
if (!getApps().length) {
    let missingConfig = false;
    const criticalConfigs: (keyof typeof firebaseConfig)[] = [
        'apiKey', 
        'authDomain', 
        'databaseURL', 
        'projectId', 
        'storageBucket',
        'messagingSenderId',
        'appId'
    ];

    for (const key of criticalConfigs) {
        const value = process.env[`NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`] || firebaseConfig[key as keyof typeof firebaseConfig];
        if (!value || typeof value !== 'string' || value.trim() === '' || value.toUpperCase().includes("YOUR_")) {
            missingConfig = true;
            console.error(
                `Firebase initialization SKIPPED. Critical config for '${key}' is missing or invalid. ` +
                `Ensure NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()} is set in your .env.local file.`
            );
        }
    }

    if (missingConfig) {
        console.error(
            'You MUST restart your Next.js development server after creating or updating the .env.local file.'
        );
        app = {} as FirebaseApp; // Assign dummy object to prevent crashes, but services will fail.
    } else {
        try {
            app = initializeApp(firebaseConfig);
            console.log('Firebase app initialized successfully.');
        } catch (error) {
            console.error('Firebase initializeApp() FAILED:', error);
            app = {} as FirebaseApp;
        }
    }
} else {
  app = getApp();
}

// Initialize services only if app was properly initialized
if (app && app.options && app.options.projectId) {
    try {
        database = getDatabase(app);
    } catch (error) {
        console.error('Firebase getDatabase() error:', error);
        database = undefined;
    }

    try {
        db = getFirestore(app);
    } catch (error) {
        console.error('Firebase getFirestore() error:', error);
        db = undefined;
    }

    try {
        auth = getAuth(app);
    } catch (error) {
        console.error('Firebase getAuth() error:', error);
        auth = undefined;
    }

    try {
        storage = getStorage(app);
    } catch (error) {
        console.error('Firebase getStorage() error:', error);
        storage = undefined;
    }
} else {
    console.warn('Firebase app object is not properly initialized. Firebase services will NOT be available.');
}

export { app, database, auth, db, storage };
