
'use server';

import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getClientIpAddress, getGeolocationData } from '@/lib/firebase/geolocation';
import type { User as AppUserType } from '@/types';


// Schema for signup data validation
const signupSchema = z.object({
  username: z.string().min(1, "Username is required."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  countryCode: z.string().optional(),
  phone: z.string().optional(),
  gameUid: z.string().optional(),
});
type SignupData = z.infer<typeof signupSchema>;


// --- Helper Functions ---
const generateReferralCode = (username: string) => {
  const namePart = username.substring(0, 4).toUpperCase().replace(/\s+/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePart}${randomSuffix}`;
};

// --- Main Server Action ---
export async function signupUser(data: any): Promise<{ success: boolean; error?: string; userId?: string }> {
  let userRecord;
  try {
    // 1. Get client IP address first. This is crucial as it depends on the request headers.
    const clientIp = await getClientIpAddress();

    // 2. Validate incoming data
    const validatedData = signupSchema.parse(data);

    // 3. Check if username already exists in the database
    const usersRef = adminDb.ref('users');
    const usernameQuery = usersRef.orderByChild('username').equalTo(validatedData.username);
    const usernameSnapshot = await usernameQuery.once('value');
    if (usernameSnapshot.exists()) {
      throw new Error("Username is already taken.");
    }
    
    // 4. Create user in Firebase Authentication
    userRecord = await adminAuth.createUser({
      email: validatedData.email,
      password: validatedData.password,
      displayName: validatedData.username,
      emailVerified: false, 
    });
    
    // 5. Prepare user data for Realtime Database
    const locationData = clientIp ? await getGeolocationData(clientIp) : null;
    const selectedDialCode = data.countryCode ? data.countryCode.split('-')[0] : '';

    const ownReferralCode = generateReferralCode(validatedData.username);

    const newUserRecord: AppUserType = {
      id: userRecord.uid,
      username: validatedData.username,
      email: validatedData.email,
      phone: `${selectedDialCode}${data.phone || ''}`,
      wallet: 0,
      tokenWallet: 0,
      role: 'user',
      isActive: true,
      lastLogin: new Date().toISOString(),
      onlineStreak: 1,
      createdAt: new Date().toISOString(),
      gameUid: validatedData.gameUid || null,
      gameName: validatedData.username,
      referralCode: ownReferralCode,
      appliedReferralCode: null,
      referredByDelegate: null,
      referralBonusReceived: 0,
      totalReferralCommissionsEarned: 0,
      location: locationData,
      watchAndEarnPoints: 0,
    };
    
    const updates: Record<string, any> = {};

    // 6. Handle Referral Logic
    if (data.referralCode?.trim()) {
        const friendCode = data.referralCode.trim().toUpperCase();
        if (friendCode !== ownReferralCode) {
            const settingsSnapshot = await adminDb.ref('globalSettings').once('value');
            const settings = settingsSnapshot.val();
            const bonusAmount = settings?.referralBonusAmount || 0;
            
            const referrerQuery = usersRef.orderByChild('referralCode').equalTo(friendCode);
            const referrerSnapshot = await referrerQuery.once('value');

            if (referrerSnapshot.exists()) {
                const referrerData = referrerSnapshot.val();
                const referrerId = Object.keys(referrerData)[0];
                const referrerProfile = referrerData[referrerId] as AppUserType;

                if (referrerId && referrerId !== userRecord.uid) {
                    newUserRecord.appliedReferralCode = friendCode;
                    
                    if (settings?.shareAndEarnEnabled && bonusAmount > 0) {
                        newUserRecord.wallet += bonusAmount;
                        newUserRecord.referralBonusReceived = bonusAmount;

                        const referrerWalletRef = adminDb.ref(`users/${referrerId}/wallet`);
                        await referrerWalletRef.set((referrerProfile.wallet || 0) + bonusAmount);

                        const referrerCommissionRef = adminDb.ref(`users/${referrerId}/totalReferralCommissionsEarned`);
                        await referrerCommissionRef.set((referrerProfile.totalReferralCommissionsEarned || 0) + bonusAmount);
                    }
                    if (referrerProfile.role === 'delegate') {
                        newUserRecord.referredByDelegate = referrerId;
                    }
                }
            }
        }
    }

    updates[`/users/${userRecord.uid}`] = newUserRecord;
    
    // 7. Perform the final database write
    await adminDb.ref().update(updates);

    return { success: true, userId: userRecord.uid };

  } catch (error: any) {
    let errorMessage = "An unknown error occurred.";
    if (error.code === 'auth/email-already-exists') {
        errorMessage = "This email is already registered.";
    } else if (error.code === 'auth/invalid-password') {
        errorMessage = "Password must be at least 6 characters long.";
    } else if (error.message) {
        errorMessage = error.message;
    }
    console.error("Signup Server Action Error:", error);
    
    // Cleanup failed auth user if DB write fails after auth user is created
    if (userRecord && userRecord.uid) {
        await adminAuth.deleteUser(userRecord.uid).catch(e => console.error("Failed to cleanup auth user on DB error:", e));
    }

    return { success: false, error: errorMessage };
  }
}
