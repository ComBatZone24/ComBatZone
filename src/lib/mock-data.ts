
import type { Tournament, User as AppUserType, LeaderboardEntry, WalletTransaction, TournamentPlayer, LeaderboardData, GlobalSettings, PlatformAppSettings, RedeemCodeEntry, WithdrawRequest, ChatMessage, ReferralData, WatchAndEarnData, CustomMessages } from '@/types';

// This mock data is primarily for fallback or initial structure.
// The application should prioritize fetching live data from Firebase.

// This defines a default structure for an AppUserType
export const defaultAppUser: AppUserType = {
  id: '',
  username: 'Guest',
  email: '',
  phone: '',
  wallet: 0,
  role: 'user',
  isActive: false,
  lastLogin: new Date().toISOString(),
  onlineStreak: 0,
  avatarUrl: '',
  gameUid: '',
  gameName: '',
  createdAt: new Date().toISOString(),
  watchAndEarnPoints: 0,
  referralCode: '', // Default empty referral code
  appliedReferralCode: null, // Default null
  referralBonusReceived: 0, // Default 0
  totalReferralCommissionsEarned: 0, // Default 0
};


export const mockUsersData: { [key: string]: Partial<AppUserType> } = {
  'uid_admin': {
    ...defaultAppUser, // Use the spread for defaults
    id: 'uid_admin',
    username: 'AdminMaster',
    email: 'admin@arenaace.com',
    phone: '03001234567',
    wallet: 10000,
    role: 'admin',
    isActive: true,
    lastLogin: new Date('2025-05-28').toISOString(),
    onlineStreak: 7,
    avatarUrl: 'https://placehold.co/100x100.png?text=A',
    gameUid: 'admin_game_uid',
    gameName: 'AdminGM',
    referralCode: 'ADMINREF001', // Example admin referral code
  },
  'uid_sample': { // Changed from uid_sample_user1 to uid_sample for consistency
    ...defaultAppUser, // Use the spread for defaults
    id: 'uid_sample',
    username: "PlayerOne",
    email: "player@example.com",
    phone: "03123456789",
    wallet: 150,
    role: "user",
    isActive: true,
    lastLogin: new Date('2025-05-29').toISOString(),
    onlineStreak: 5,
    avatarUrl: 'https://placehold.co/100x100.png?text=P1',
    gameUid: 'game_uid_p1',
    gameName: 'NoobSlayer',
    watchAndEarnPoints: 250,
    referralCode: 'PLAYERONE001', // Example user referral code
  },
};

// This function is deprecated for user-facing pages.
// Pages should use onAuthStateChanged to get the live Firebase user.
// It's kept here to avoid breaking admin panel parts that might still (incorrectly) rely on it.
export function getCurrentUser(): AppUserType | null {
  console.warn(
    "getCurrentUser() from mock-data.ts is being called. " +
    "This function is deprecated for user-facing views. " +
    "Pages should derive the current user from onAuthStateChanged (Firebase Auth state)."
  );
  // To test as ADMIN:
  // const userIdToFind = 'uid_admin';
  // To test as REGULAR USER:
  const userIdToFind = 'uid_sample';

  const userData = mockUsersData[userIdToFind];
  if (!userData) return null;

  // Ensure all fields from AppUserType are present, merging with defaultAppUser
  return {
    ...defaultAppUser, // Start with the complete default structure
    id: userIdToFind,  // Override id
    ...userData,       // Spread fetched mock data, potentially overwriting defaults
  };
}


export const mockTournamentsData: { [key: string]: Partial<Tournament> } = {}; // Should be fetched from Firebase
export const mockTournaments: Tournament[] = []; // Derived from live data

export const mockFirebaseLeaderboardData: { [key: string]: LeaderboardData } = {}; // Should be fetched from Firebase
export const mockLeaderboard: LeaderboardEntry[] = []; // Derived from live data

export const mockUserWalletTransactions: { [userId: string]: { [transactionId: string]: Partial<WalletTransaction> } } = {}; // Should be fetched from Firebase
export const mockWalletTransactions: WalletTransaction[] = []; // Derived from live data


export const mockGlobalSettings: GlobalSettings = {
  appName: 'Arena Ace',
  appLogoUrl: '',
  registrationEnabled: true,
  shareAndEarnEnabled: true,
  watchAndEarnEnabled: true,
  globalChatEnabled: false,
  redeemCodeEnabled: true,
  customMessageEnabled: true,
  dailyUserLimit: 300,
  onesignalAppId: "YOUR_ONESIGNAL_APP_ID_HERE",
  onesignalApiKey: "YOUR_ONESIGNAL_API_KEY_HERE",
  liveTournamentEditingEnabled: false,
  contactWhatsapp: "https://wa.me/1234567890",
  contactEmail: "mailto:support@example.com",
  socialMediaFacebook: "https://facebook.com/yourpage",
  socialMediaInstagram: "https://instagram.com/yourprofile",
  socialMediaYoutube: "https://youtube.com/yourchannel",
  
  watchAndEarnAdIdentifiers: {
    banner: "ca-app-pub-3940256099942544/6300978111", // Test ID
    interstitial: "ca-app-pub-3940256099942544/1033173712", // Test ID
    rewarded: "ca-app-pub-3940256099942544/5224354917", // Test ID
    native: "ca-app-pub-3940256099942544/2247696110", // Test ID
  },
  pointsPerAdWatch: 1,
  pointsToCurrencyRate: 300,
  currencyPerRate: 210,
  
  referralBonusAmount: 5,
  shareLinkBaseUrl: "https://yourapp.example.com/auth/signup", // Example base URL
};

export const mockPlatformAppSettings: PlatformAppSettings = {
  inactivityPolicy: {
    daysInactive: 30,
    holdPeriod: 3,
    finalDeleteAfter: 7
  },
  autoNotifyOnActiveUser: true
};

export const mockRedeemCodesFirebase: { [key: string]: RedeemCodeEntry } = {}; // Managed via Admin panel / Firebase

export const mockWithdrawRequests: { [key: string]: WithdrawRequest } = {}; // Managed via Admin panel / Firebase

export const mockCustomMessages: CustomMessages = {
  activeMessage: "Welcome to the Arena Ace tournament platform!"
};

export const mockReferrals: { [userId: string]: ReferralData } = {}; // To be managed via Firebase

// WatchAndEarnData is largely superseded by User.watchAndEarnPoints for current needs
export const mockWatchAndEarn: { [userId: string]: WatchAndEarnData } = {};

export const mockGlobalChat: { [key: string]: ChatMessage } = {}; // To be managed via Firebase
