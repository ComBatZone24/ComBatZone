

import {
  Home,
  Wallet,
  BarChart3,
  User,
  LayoutDashboard,
  Gamepad2,
  Users,
  Settings,
  LogIn,
  UserPlus,
  DownloadCloud,
  Award,
  MessagesSquare,
  History,
  ShoppingCart,
  TicketPercent,
  ShoppingBag,
  ShieldCheck,
  UserCog,
  Link as LinkIconLucide,
  Vote,
  Coins,
  Gift,
  Palette,
  Ticket,
  Share2,
  Trophy,
  Tv,
  DollarSign,
  GitBranch,
  BarChart2,
  Send,
  ImagePlay,
  Cpu,
  Smartphone,
  Wand2,
  Globe,
  Database,
  MousePointerClick,
  Upload,
  ArrowUpCircle,
  SquareDashedKanban,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  description?: string;
  permissionKey?: string; // For delegate access control
}

export const bottomNavItems: NavItem[] = [
  { title: 'Home', href: '/', icon: Home, description: 'Go to homepage' },
  {
    title: 'Tournaments',
    href: '/tournaments',
    icon: Trophy,
    description: 'Browse matches, results, and leaderboards',
  },
  {
    title: 'Polls',
    href: '/polls',
    icon: Vote,
    description: 'Vote on community polls and see posts',
  },
  {
    title: 'Shop',
    href: '/shop',
    icon: ShoppingCart,
    description: 'Browse our shop',
  },
  {
    title: 'Crypto',
    href: '/crypto',
    icon: Coins,
    description: 'Manage your crypto tokens',
  },
  {
    title: 'Earn Tasks',
    href: '/earn-tasks',
    icon: Coins,
    description: 'Complete tasks to earn rewards',
  },
  {
    title: 'Wallet',
    href: '/wallet',
    icon: Wallet,
    description: 'Manage your funds',
  },
  {
    title: 'Profile',
    href: '/profile',
    icon: User,
    description: 'View and edit your profile',
  },
];

export const authNavItems: NavItem[] = [
  {
    title: 'Login',
    href: '/auth/login',
    icon: LogIn,
    description: 'Access your account',
  },
  {
    title: 'Sign Up',
    href: '/auth/signup',
    icon: UserPlus,
    description: 'Create a new account',
  },
];

export const adminNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    description: 'Get a high-level overview of key platform statistics and recent activities.',
    permissionKey: 'dashboard',
  },
  {
    title: 'Task Analysis',
    href: '/admin/task-analysis',
    icon: BarChart3,
    description: "Analyze 'Click & Earn' statistics, including points earned and user engagement.",
    permissionKey: 'taskAnalysis',
  },
  {
    title: 'User Demographics',
    href: '/admin/demographics',
    icon: Globe,
    description: 'Analyze user location data, including countries, cities, and flags.',
    permissionKey: 'demographics',
  },
  {
    title: 'Referral Analysis',
    href: '/admin/referral-analysis',
    icon: GitBranch,
    description: 'Track delegate performance by referred users and their top-up contributions.',
    permissionKey: 'referralAnalysis',
  },
  {
    title: 'Tournament Analysis',
    href: '/admin/tournament-analysis',
    icon: BarChart3,
    description: 'Analyze tournament creation statistics and profitability for each delegate.',
    permissionKey: 'tournamentAnalysis',
  },
  {
    title: 'Profit Calculator',
    href: '/admin/profit-calculator',
    icon: BarChart2,
    description: 'Calculate the profit for any individual completed tournament.',
    permissionKey: 'profitCalculator',
  },
  {
    title: 'Manage Tournaments',
    href: '/admin/tournaments',
    icon: Gamepad2,
    description: 'Create new tournaments, edit existing ones, and view player lists.',
    permissionKey: 'tournaments',
  },
  {
    title: 'Manage Results',
    href: '/admin/results',
    icon: Award,
    description: 'Input scores, finalize standings, and publish results for completed tournaments.',
    permissionKey: 'results',
  },
  {
    title: 'Manage Leaderboard',
    href: '/admin/leaderboard',
    icon: BarChart3,
    description: 'Manually add, edit, or remove players from the main leaderboard.',
    permissionKey: 'leaderboards',
  },
  {
    title: 'Manage Users',
    href: '/admin/users',
    icon: Users,
    description: 'Search, view, and edit user profiles, roles, and balances.',
    permissionKey: 'users',
  },
  {
    title: 'Listed Admins',
    href: '/admin/sub-admins',
    icon: ShieldCheck,
    description: 'View a filtered list of all users with full administrative privileges.',
    permissionKey: 'subAdmins',
  },
  {
    title: 'Manage Delegates',
    href: '/admin/manage-delegates',
    icon: UserCog,
    description: 'Assign specific screen access permissions to other users (delegates).',
    permissionKey: 'manageDelegates',
  },
  {
    title: 'Withdrawals',
    href: '/admin/withdrawals',
    icon: DownloadCloud,
    description: 'Review and process withdrawal requests submitted by users.',
    permissionKey: 'withdrawals',
  },
  {
    title: 'Mobile Load Requests',
    href: '/admin/mobile-load-requests',
    icon: Smartphone,
    description: 'Review and process mobile load requests from users.',
    permissionKey: 'mobileLoadRequests',
  },
  {
    title: 'Shop Orders',
    href: '/admin/shop-orders',
    icon: ShoppingBag,
    description: 'Track and fulfill product purchase requests from the shop.',
    permissionKey: 'shopOrders',
  },
  {
    title: 'Shop Management',
    href: '/admin/shop',
    icon: ShoppingCart,
    description: 'Add new items, edit pricing, stock, and details for the user-facing shop.',
    permissionKey: 'shop',
  },
  {
    title: 'Coupon Management',
    href: '/admin/coupons',
    icon: TicketPercent,
    description: 'Generate and manage discount codes for the shop.',
    permissionKey: 'coupons',
  },
  {
    title: 'Manage Polls',
    href: '/admin/polls',
    icon: Vote,
    description: 'Create community polls and manage promotional posts displayed to users.',
    permissionKey: 'polls',
  },
  {
    title: 'Communications Log',
    href: '/admin/messages',
    icon: MessagesSquare,
    description: 'Send messages to users and view a log of all communications.',
    permissionKey: 'messages',
  },
   {
    title: 'WhatsApp Sender',
    href: '/admin/whatsapp-sender',
    icon: Send,
    description: 'Manually send tournament notifications to users via WhatsApp.',
    permissionKey: 'whatsappSender',
  },
  {
    title: 'Transaction History',
    href: '/admin/transactions',
    icon: History,
    description: 'Monitor a complete log of all wallet activities across the platform.',
    permissionKey: 'transactions',
  },
  {
    title: 'Platform Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Access the hub for all site-wide settings and feature configurations.',
    permissionKey: 'settings',
  },
];

export const settingsCategories = [
  {
    title: 'General Features',
    href: '/admin/settings/general',
    icon: Settings,
    description: 'Enable/disable core platform functionalities.',
  },
  {
    title: 'Branding',
    href: '/admin/settings/branding',
    icon: Palette,
    description: 'Customize app name, logo, and colors.',
  },
  {
    title: 'App Update',
    href: '/admin/settings/app-update',
    icon: ArrowUpCircle,
    description: 'Manage forced app updates for APK versions.',
  },
  {
    title: 'Manage Games',
    href: '/admin/settings/games',
    icon: Gamepad2,
    description: 'Enable/disable betting games like Duels & Spin Wheel.',
  },
  {
    title: 'Crypto Token',
    href: '/admin/settings/crypto-token',
    icon: Coins,
    description: 'Manage the in-app crypto token economy.',
  },
  {
    title: 'Daily Rewards',
    href: '/admin/settings/daily-rewards',
    icon: Gift,
    description: 'Configure daily login rewards for users.',
  },
  {
    title: 'YouTube Promotion',
    href: '/admin/settings/youtube-promotion',
    icon: Tv,
    description: 'Manage YouTube subscription tasks and live streams.',
  },
  {
    title: 'Click & Earn',
    href: '/admin/settings/click-and-earn',
    icon: LinkIconLucide,
    description: 'Manage links and points conversion for users.',
  },
   {
    title: 'Ad Monetization',
    href: '/admin/settings/ad-monetization',
    icon: DollarSign,
    description: 'Manage Adsterra ad links and popups.',
  },
  {
    title: 'CPAGrip & Postback',
    href: '/admin/settings/cpa-grip',
    icon: Lock,
    description: 'Configure CPAGrip file locker ads and postback.',
  },
  {
    title: 'Promo Pop-up',
    href: '/admin/settings/promo-popup',
    icon: Gift,
    description: 'Configure a promotional pop-up dialog for users.',
  },
  {
    title: 'Scrolling Banner',
    href: '/admin/settings/scrolling-banner',
    icon: ImagePlay,
    description: 'Manage the scrolling promo banners on the homepage.',
  },
  {
    title: 'Redeem Code Management',
    href: '/admin/settings/redeem',
    icon: Ticket,
    description: 'Create and manage redeem codes for users.',
  },
  {
    title: 'Share & Earn',
    href: '/admin/settings/sharing',
    icon: Share2,
    description: 'Configure referral program settings.',
  },
  {
    title: 'Contact & Social Links',
    href: '/admin/settings/contact',
    icon: LinkIconLucide,
    description: 'Manage public contact and social media URLs.',
  },
  {
    title: 'User Inactivity Policy',
    href: '/admin/settings/user-inactivity',
    icon: Users,
    description: 'Define rules for handling inactive accounts.',
  },
  {
    title: 'Deployment Guide',
    href: '/admin/deployment-guide',
    icon: Upload,
    description: 'Instructions on how to deploy your app outside of Firebase Studio.',
  },
  {
    title: 'Database Backup',
    href: '/admin/settings/backup',
    icon: Database,
    description: 'Download or restore the entire application database.',
  },
];
