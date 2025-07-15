
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { ref, onValue, off, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, database } from '@/lib/firebase/config'; // Your Firebase config
import type { User as AppUserType } from '@/types'; // Your custom user type

// 1. DEFINING THE CONTEXT TYPE
interface AuthContextType {
  user: AppUserType | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 2. HELPER FUNCTION FOR A FALLBACK USER
// This function creates a default user profile if one doesn't exist in the database.
const buildFallbackUser = (fbUser: FirebaseUser): AppUserType => ({
  id: fbUser.uid,
  username: fbUser.displayName || fbUser.email?.split('@')[0] || 'Anonymous',
  email: fbUser.email || '',
  avatarUrl: fbUser.photoURL || null,
  role: 'user',
  isActive: true,
  createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  // Add other default fields from your AppUserType
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

  useEffect(() => {
    let dbUnsubscribe: () => void = () => {};
    let presenceUnsubscribe: (() => void) | null = null;

    // This listener handles changes in user authentication (login/logout).
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous listeners before setting up new ones
      dbUnsubscribe();
      if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
      }
      
      // If a user logs out, clean up and reset state.
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // If a user logs in, set up listeners for their data.
      const userRef = ref(database, `users/${firebaseUser.uid}`);
      
      // Real-time presence management
      const presenceRef = ref(database, `.info/connected`);
      const userStatusRef = ref(database, `users/${firebaseUser.uid}/isOnline`);
      const lastSeenRef = ref(database, `users/${firebaseUser.uid}/lastLogin`);

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
              ...buildFallbackUser(firebaseUser),
              ...dbUser,
              id: firebaseUser.uid,
              email: firebaseUser.email,
            });
          } else {
            console.warn(`No database entry for user ${firebaseUser.uid}. Using fallback profile.`);
            setUser(buildFallbackUser(firebaseUser));
          }
          setLoading(false);
        },
        (error) => {
          console.error("Firebase onValue error:", error);
          setUser(buildFallbackUser(firebaseUser));
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      dbUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

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
