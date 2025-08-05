
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode, useCallback } from 'react';
import { ref, onValue, get, onDisconnect, set, serverTimestamp, off } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, database } from '@/lib/firebase/config'; // Your Firebase config
import type { User as AppUserType } from '@/types'; // Your custom user type
import { useRouter } from 'next/navigation';

// 1. DEFINING THE CONTEXT TYPE
interface AuthContextType {
  user: AppUserType | null;
  authUser: FirebaseUser | null; // Expose Firebase user for specific tasks
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
    const currentFbUser = auth.currentUser;
    if (!currentFbUser || !database) return;

    const userRef = ref(database, `users/${currentFbUser.uid}`);
    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const dbUser = snapshot.val();
        setUser({
          ...buildFallbackUser(currentFbUser),
          ...dbUser,
          id: currentFbUser.uid,
          email: currentFbUser.email,
        });
      }
    } catch (error) {
      console.error("Error manually refreshing user data:", error);
    }
  }, []);

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
        setLoading(false); // CRITICAL: Set loading to false when user logs out
        return;
      }
      
      if (!database) {
        console.error("AuthContext: Firebase Database is not initialized. Cannot set up user listeners.");
        setUser(buildFallbackUser(fbUser)); 
        setLoading(false); // CRITICAL: Set loading to false on DB error
        return;
      }

      const userRef = ref(database, `users/${fbUser.uid}`);
      const presenceRef = ref(database, `.info/connected`);
      const userStatusRef = ref(database, `users/${fbUser.uid}/isOnline`);

      setLoading(true);
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
          setLoading(false); // CRITICAL: Set loading to false after DB data is processed
        },
        (error: any) => {
          console.error("Firebase onValue error:", error.code, error.message);
          if (error.code === 'database/disconnected' || error.code === 'database/max-connections') {
              console.warn("Max Firebase connections reached or disconnected. Redirecting to offline page.");
              router.push('/offline');
          } else {
              setUser(buildFallbackUser(fbUser));
          }
          setLoading(false); // CRITICAL: Set loading to false on DB error
        }
      );
    });

    return () => {
      unsubscribeAuth();
      dbUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, [router]);

  const value = useMemo(() => ({ user, authUser: firebaseUser, loading, refreshUser }), [user, firebaseUser, loading, refreshUser]);

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
