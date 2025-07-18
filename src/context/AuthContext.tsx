
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode, useCallback } from 'react';
import { ref, onValue, get, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, database } from '@/lib/firebase/config'; // Your Firebase config
import type { User as AppUserType } from '@/types'; // Your custom user type
import { useRouter } from 'next/navigation';

// 1. DEFINING THE CONTEXT TYPE
interface AuthContextType {
  user: AppUserType | null;
  loading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 2. HELPER FUNCTION FOR A FALLBACK USER
const buildFallbackUser = (fbUser: FirebaseUser): AppUserType => ({
  id: fbUser.uid,
  username: fbUser.displayName || fbUser.email?.split('@')[0] || 'Anonymous',
  email: fbUser.email || '',
  avatarUrl: fbUser.photoURL || null,
  role: 'user',
  isActive: true,
  createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  phone: '',
  wallet: 0,
  tokenWallet: 0,
  onlineStreak: 0,
  gameUid: null,
  gameName: null,
  referralCode: '',
  appliedReferralCode: null,
  referralBonusReceived: 0,
  totalReferralCommissionsEarned: 0,
  watchAndEarnPoints: 0,
});

// 3. THE AUTHENTICATION PROVIDER COMPONENT
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const router = useRouter(); // Get the router instance

  const refreshUser = useCallback(async () => {
    if (!firebaseUser || !database) return;

    const userRef = ref(database, `users/${firebaseUser.uid}`);
    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const dbUser = snapshot.val();
        setUser({
          ...buildFallbackUser(firebaseUser),
          ...dbUser,
          id: firebaseUser.uid,
          email: firebaseUser.email,
        });
      }
    } catch (error) {
      console.error("Error manually refreshing user data:", error);
    }
  }, [firebaseUser]);

  useEffect(() => {
    let dbUnsubscribe: () => void = () => {};
    let presenceUnsubscribe: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      dbUnsubscribe();
      if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
      }
      
      setFirebaseUser(fbUser);

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (!database) {
        console.error("AuthContext: Firebase Database is not initialized. Cannot set up user listeners.");
        setLoading(false);
        return;
      }

      const userRef = ref(database, `users/${fbUser.uid}`);
      const presenceRef = ref(database, `.info/connected`);
      const userStatusRef = ref(database, `users/${fbUser.uid}/isOnline`);
      const lastSeenRef = ref(database, `users/${fbUser.uid}/lastLogin`);

      onValue(presenceRef, (snap) => {
        if (snap.val() === true) {
          set(userStatusRef, true);
          onDisconnect(userStatusRef).set(false);
          onDisconnect(lastSeenRef).set(serverTimestamp());
        }
      });
      presenceUnsubscribe = () => onDisconnect(userStatusRef).cancel();

      dbUnsubscribe = onValue(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const dbUser = snapshot.val();
            setUser({
              ...buildFallbackUser(fbUser),
              ...dbUser,
              id: fbUser.uid,
              email: fbUser.email,
            });
          } else {
            console.warn(`No database entry for user ${fbUser.uid}. Using fallback profile.`);
            setUser(buildFallbackUser(fbUser));
          }
          setLoading(false);
        },
        (error: any) => {
          console.error("Firebase onValue error:", error.code, error.message);
          // Gracefully handle max connection errors
          if (error.code === 'database/disconnected' || error.code === 'database/max-connections') {
              console.warn("Max Firebase connections reached or disconnected. Redirecting to offline page.");
              router.push('/offline');
          } else {
              setUser(buildFallbackUser(fbUser));
          }
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      dbUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, [router]); // Add router to dependency array

  const value = useMemo(() => ({ user, loading, refreshUser }), [user, loading, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. CUSTOM HOOK FOR EASY CONTEXT ACCESS
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

