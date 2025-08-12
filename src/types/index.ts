
export interface User {
  id: string;
  username: string;
  email?: string;
  phone: string | null;
  whatsappNumber?: string; // Dedicated WhatsApp number
  wallet: number;
  tokenWallet?: number;
  role: 'user' | 'admin' | 'delegate';
  isActive: boolean;
  isOnline?: boolean; // For real-time presence
  lastLogin: string; // ISO string
  createdAt: string; // ISO string
  onlineStreak?: number;
  lastLoginRewardClaim?: string;
  avatarUrl?: string | null;
  gameUid?: string | null;
  gameName?: string | null;
  referralCode?: string | null;
  appliedReferralCode?: string | null;
  referredByDelegate?: string | null; // UID of the referring delegate
  referralBonusReceived?: number;
  referrerBonusPaid?: boolean; // New flag to track if the referrer has been paid for this user's signup
  totalReferralCommissionsEarned?: number;
  watchAndEarnPoints?: number;
  youtubeSubscriptionAwarded?: boolean;
  delegatePermissions?: {
    accessScreens: Record<string, boolean>;
  };
  location?: {
    ip: string;
    country_name?: string;
    city?: string;
    country_flag?: string;
    isp?: string;
  } | null;
  userClickAndEarnClaims?: Record<string, number>; // linkId: timestamp
  completedCpaOffers?: Record<string, boolean>; // offerUrlId (base64): true
  cpaMilestoneProgress?: { // New
    count: number;
  };
  dailyClickAndEarn?: {
    date: string; // YYYY-MM-DD
    clickCount: number;
    batchCooldownUntil?: number; // Timestamp
  };
  cpuMiningEarnedCoins?: number;
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  mode: 'Solo' | 'Duo' | 'Squad' | 'Custom';
  entryFee: number;
  prizePool: number;
  perKillReward: number;
  maxPlayers: number;
  playersJoined: { [key: string]: TournamentPlayer };
  joinedPlayersCount: number;
  status: 'upcoming' | 'live' | 'completed' | 'archived';
  startTime: string; // ISO string
  youtubeLive?: string | null;
  customRules?: string | null;
  resultsPosted: boolean;
  bannerImageUrl?: string | null;
  map?: string | null;
  roomId?: string | null;
  roomPassword?: string | null;
  createdBy?: string | null; // UID of the admin/delegate who created it
  resultsProcessingTime?: string | null; // ISO string
  autoPostResults?: boolean;
  autoPostCompleted?: boolean;
}

export interface TournamentPlayer {
  uid: string;
  username?: string; // App username
  gameName: string; // In-game name
  kills: number;
  avatarUrl?: string | null; // App avatar
  joinTime: string; // ISO string
  teamMembers?: Array<{ gameName: string; uid:string }>;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderUsername: string;
  senderAvatar?: string | null;
  message: string;
  timestamp: number;
  isAdmin?: boolean;
}

export interface MobileLoadRequest {
  id: string;
  uid: string;
  username: string;
  amount: number;
  network: string;
  phoneNumber: string;
  status: 'pending' | 'completed' | 'rejected';
  requestDate: string; // ISO string
  processedDate?: string; // ISO string
  adminNotes?: string;
  walletTransactionId?: string; // Link to the hold transaction
}

export interface WithdrawRequest {
  id: string;
  uid: string;
  username: string;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'completed' | 'rejected';
  requestDate: string; // ISO string
  processedDate?: string; // ISO string
  adminNotes?: string;
  walletTransactionId?: string; // Link to the initial 'on_hold' transaction
}

export interface WalletTransaction {
  id: string;
  userId?: string; // Optional for backward compatibility, but should be present
  type: 'topup' | 'withdrawal' | 'entry_fee' | 'prize' | 'redeem_code' | 'referral_bonus_received' | 'referral_commission_earned' | 'refund' | 'shop_purchase_hold' | 'shop_purchase_complete' | 'spin_wheel_bet' | 'spin_wheel_win' | 'duel_bet' | 'duel_win' | 'watch_earn_conversion' | 'token_purchase' | 'token_sale_payout' | 'market_purchase' | 'market_sale_payout' | 'daily_login_reward' | 'cpa_grip_reward';
  amount: number; // Positive for income, negative for expense
  status: 'pending' | 'completed' | 'rejected' | 'on_hold' | 'refunded';
  date: string; // ISO string
  description: string;
  relatedTournamentId?: string;
  relatedRequestId?: string; // For linking refunds to rejected requests
  relatedProductId?: string; // For linking to shop items
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'buy_from_admin' | 'sell_to_admin' | 'transfer_out' | 'transfer_in' | 'market_sell' | 'market_buy' | 'market_cancel' | 'spin_wheel_bet' | 'spin_wheel_win';
  amount: number; // Positive for credits, negative for debits
  pkrValue?: number;
  description: string;
  date: number; // Firebase server timestamp
  counterpartyId?: string;
  counterpartyUsername?: string;
}

export interface TokenEconomyData {
  circulatingSupply: number;
  volumeSinceLastAdjustment?: number;
}


export interface LeaderboardEntry {
  userId: string;
  username: string;
  inGameName: string;
  inGameUID: string;
  kills: number;
  rank: number;
  avatarUrl?: string | null;
}

// For DB structure under /leaderboards/{uid}
export interface LeaderboardData {
  username: string;
  inGameName: string;
  inGameUID: string;
  kills: number;
  wins: number;
  earnings: number;
  avatarUrl?: string | null;
}

export interface PlayerResultStats {
  username?: string;
  inGameName?: string;
  kills?: number;
  position?: number;
  earnings?: number;
  avatarUrl?: string | null;
  firebaseUid?: string; // UID of the firebase user, if linked
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  stock: number;
  imageUrl: string;
  active: boolean;
  createdAt?: any; 
  updatedAt?: any;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startDate: string; // ISO string
  expiryDate: string; // ISO string
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  appliesTo: 'full_shop' | 'per_item';
  applicableItemIds?: string[];
  claimedBy?: Record<string, { purchaseId: string, timestamp: string }[]>; // Map UID to array of claims
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ShopOrder {
    id: string;
    userId: string;
    username: string;
    productId: string;
    productName: string;
    productPrice: number;
    shippingDetails: {
        fullName: string;
        address: string;
        phone: string;
        city: string;
        postalCode: string;
    };
    orderTimestamp: any; // Can be string (ISO) or Firebase ServerValue
    status: 'pending_fulfillment' | 'shipped' | 'delivered' | 'cancelled' | 'payment_failed';
    trackingNumber?: string;
    walletHoldTransactionId: string; // Link to the 'on_hold' wallet transaction
    couponUsed?: string | null;
    discountApplied?: number | null;
}

export interface PlatformAppSettings {
  inactivityPolicy: InactivityPolicy;
  autoNotifyOnActiveUser: boolean;
  updatedAt?: string;
}

export interface InactivityPolicy {
  daysInactive: number;
  holdPeriod: number;
  finalDeleteAfter: number;
}

export interface RedeemCodeEntry {
  amount: number;
  isUsed: boolean;
  usedBy: string | null; 
  createdAt: string; // ISO string
  createdBy?: string; // UID of admin/delegate who created it
  createdByName?: string; // Name of admin/delegate
  maxUses: number;
  timesUsed: number;
  claimedBy: { [uid: string]: string }; // Maps user UID to ISO timestamp
}

export interface ReferralData {
  referredBy: string; // UID of the referrer
  commissionEarned: number;
  joinDate: string; // ISO string
}

export interface WatchAndEarnData {
  points: number;
  lastAdWatchTime?: string; // ISO string
}

export interface CustomMessages {
  activeMessage: string;
}

export interface PromoPost {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    buttonText?: string;
    buttonLink?: string;
    enabled: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface Poll {
    id: string;
    question: string;
    options: { [key: string]: { id: string; text: string; votes: number; } };
    isActive: boolean;
    voters: { [key: string]: boolean }; // Map UID to true if voted
    createdAt: any;
}

export interface UserNotification {
    id: string;
    text: string;
    timestamp: number;
    read: boolean;
    type: 'admin_message' | 'order_shipped' | 'order_cancelled' | 'tournament_reminder' | 'generic';
    link?: string;
}

export interface AdsterraSettings {
  enabled: boolean;
  directLinks?: string[];
  popupsEnabled?: boolean;
  popupMinInterval: number;
  popupMaxInterval: number;
  buttonAdPlacements?: Record<string, boolean>;
}


export interface ClickAndEarnLink {
  id: string;
  title: string;
  url: string;
  createdAt?: any;
}

export interface YouTubePromotionSettings {
  enabled: boolean;
  youtubeChannelName: string;
  youtubeChannelUrl: string;
  youtubeChannelBannerUrl: string;
  youtubeChannelProfileUrl: string;
  pointsForSubscription: number;
  liveStreamUrl?: string | null;
  liveStreamEnabled?: boolean;
}

export interface SellOrder {
  id: string;
  sellerId: string;
  sellerUsername: string;
  tokenAmount: number;
  pricePerToken: number; // in PKR
  status: 'active' | 'completed' | 'cancelled';
  createdAt: any; // ServerValue.TIMESTAMP
  buyerId?: string;
  buyerUsername?: string;
  completedAt?: any;
}

// New Type for AI Theming
export interface ColorTheme {
    primary: string; // hsl(279, 100%, 35%)
    secondary: string; // hsl(210, 10%, 30%)
    accent: string; // hsl(274, 100%, 55%)
    background: string; // hsl(210, 15%, 10%)
    foreground: string; // hsl(210, 15%, 90%)
    card: string; // hsl(210, 15%, 15%)
    destructive: string; // hsl(0, 70%, 50%)
}

// New Type for Cloudinary Upload
export interface CloudinaryUploadResult {
    asset_id: string;
    public_id: string;
    version: number;
    version_id: string;
    signature: string;
    width: number;
    height: number;
    format: string;
    resource_type: string;
    created_at: string;
    tags: string[];
    bytes: number;
    type: string;
    etag: string;
    placeholder: boolean;
    url: string;
    secure_url: string;
    folder: string;
    access_mode: string;
    original_filename: string;
}

export interface StepAndEarnSettings {
  pointsPerStep: number;
  adViewsToClaim: number;
  requireVpn: boolean;
}

export interface AppUpdateSettings {
    latestVersionCode: number;
    latestVersionName: string; // Added for human-readable version
    apkUrl: string;
    forceUpdate: boolean;
    updateMessage: string;
}

export interface CpaGripSettings {
  enabled: boolean;
  title: string;
  description: string;
  offerUrls: string[];
  points: number;
  postbackKey: string;
  requiredCompletions: number; // New
}

export interface CpuMiningSettings {
  enabled: boolean;
  throttle: number; // 0 to 99
  coinsPer1MHashes: number; // New field for earning rate
  cardTitle: string;
  cardDescription: string;
  viewStatsButtonText: string;
  dialogTitle: string;
  dialogDescription: string;
  coinsEarnedLabel: string;
  startMiningButtonText: string;
  stopMiningButtonText: string;
}


export interface GlobalSettings {
  appName: string;
  appLogoUrl: string;
  appUpdate?: AppUpdateSettings; 
  feyorraLogoUrl?: string | null;
  feyorraTaskEnabled?: boolean;
  rollerCoinTaskEnabled?: boolean;
  registrationEnabled: boolean;
  limitRegistrationsEnabled?: boolean;
  maxRegistrations?: number;
  shareAndEarnEnabled: boolean;
  watchAndEarnEnabled: boolean; // This might be deprecated
  globalChatEnabled: boolean;
  clickAndEarnEnabled: boolean; // For toggling the entire feature
  redeemCodeEnabled: boolean;
  customMessageEnabled: boolean;
  mobileLoadEnabled?: boolean; // New setting for mobile load
  shopEnabled?: boolean; // New setting for the shop
  dailyUserLimit?: number;
  onesignalAppId?: string; // New for OneSignal
  onesignalApiKey?: string; // New for OneSignal
  admobRewardedAdUnitId?: string;
  
  // Daily Ad Task settings
  dailyAdTaskReward?: number;
  dailyAdTaskSettings?: {
    stayDurationSeconds: number;
    linkRepeatHours: number;
    postRewardCooldownSeconds: number;
  };
  
  pkrPerPoint?: number;
  dailyTargetClicks?: number;
  dailyTargetReward?: number;
  
  clickAndEarnTitle?: string;
  clickAndEarnDescription?: string;
  updatedAt?: any; // To track last save time

  // Task URLs
  feyorraReferralUrl?: string;
  rollerCoinReferralUrl?: string;
  linkvertiseTaskEnabled?: boolean;
  linkvertiseUrl?: string;

  // Contact & Social
  contactWhatsapp: string[]; // Changed to array
  contactEmail: string;
  socialMediaFacebook: string;
  socialMediaInstagram: string;
  socialMediaYoutube: string;

  // Sub-settings objects
  dailyLoginRewards?: {
    enabled: boolean;
    rewards: number[]; // Array of 7 numbers for each day
  };
  
  duelsCardSettings?: {
      enabled: boolean;
      title: string;
      description?: string;
      imageUrl: string;
      buttonText: string;
  };

  spinWheelSettings?: {
      enabled: boolean;
      title: string;
      description?: string;
      imageUrl: string;
      buttonText: string;
      winRate?: number;
      largeBetThreshold?: number;
      largeBetWinRate?: number;
      segments?: {
          label: string;
          multiplier: number;
          color: string;
      }[];
  };

  dragonTigerSettings?: {
      enabled: boolean;
      title: string;
      description?: string;
      imageUrl?: string;
      dragonImageUrl?: string;
      tigerImageUrl?: string;
      tieImageUrl?: string;
      buttonText: string;
      chips: { value: number; winRate: number; }[];
      dragonTotalReturnMultiplier?: number;
      tigerTotalReturnMultiplier?: number;
      tieTotalReturnMultiplier?: number;
      tieWinningsMultiplier?: number; // Deprecated - use tieTotalReturnMultiplier
      tieFrequency?: number;
      roundTimer?: number;
  };
  
  promoPopup?: {
      enabled: boolean;
      promoType: 'media' | 'tournament' | 'product';
      promoMediaUrl: string | null;
      promoMediaType: 'image' | 'video';
      selectedItemId: string | null; // Can be tournament ID or product ID
      displayLocation: 'homepage' | 'all_pages';
      promoTitle?: string | null;
      promoDescription?: string | null;
      promoButtonText?: string | null;
      promoButtonLink?: string | null;
  };
  
  youtubePromotionSettings?: YouTubePromotionSettings;
  tokenSettings?: TokenSettings;
  adsterraSettings?: AdsterraSettings;
  cpaGripSettings?: CpaGripSettings;
  cpuMiningSettings?: CpuMiningSettings;
  scrollingBanners?: Record<string, PromoPost>; // For the new feature
  timebucksTaskSettings?: {
      enabled: boolean;
      referralUrl: string;
  };
  customTaskCardSettings?: {
      enabled: boolean;
      imageUrl: string;
      title: string;
      description: string;
      buttonText: string;
      buttonLink: string;
  }
}
