
import type { Metadata, Viewport } from 'next';
import { Orbitron, Poppins } from 'next/font/google'; // Import Poppins
import Script from 'next/script'; // Import the Script component
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/layout/AppShell';
import { AuthProvider } from '@/context/AuthContext';
import FirebaseInitializer from '@/components/FirebaseInitializer';
import PromotionalDialog from '@/components/PromotionalDialog';
import DailyRewardManager from '@/components/rewards/DailyRewardManager';
import { FloatingChatProvider } from '@/context/FloatingChatContext';
import { AdProvider } from '@/context/AdContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { UpdateProvider } from '@/context/UpdateContext';
import LinkvertiseScript from '@/components/core/LinkvertiseScript';
import { MiningProvider } from '@/context/MiningContext';
import CpuMiningDialog from '@/components/games/CpuMiningDialog';

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-orbitron',
});

// Setup Poppins font
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

const APP_NAME = "ComBatZone";
const APP_DESCRIPTION = "Join ComBatZone for daily eSports tournaments for games like PUBG, Free Fire, and BGMI in Pakistan. Compete in our gaming arena, climb the leaderboards, and win real prizes. Your journey to pro gaming starts here!";
const APP_URL = "https://com-bat-zone-92v2.vercel.app/";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME}: Pakistan's eSports Tournaments & Gaming Platform`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  keywords: [
    "esports pakistan", 
    "pubg tournaments pakistan", 
    "free fire tournaments", 
    "gaming arena pakistan", 
    "ComBatZone", 
    "mobile gaming", 
    "online gaming tournaments",
    "competitive gaming pakistan",
    "BGMI tournaments",
    "eSports platform",
    "win cash prizes gaming",
    "pro gaming pakistan",
    "daily tournaments",
    "esports community",
    "mobile esports"
  ],
  authors: [{ name: "ComBatZone Admin", url: APP_URL }],
  creator: "ComBatZone",
  publisher: "ComBatZone",
  
  // Open Graph Metadata for Social Sharing
  openGraph: {
    type: "website",
    url: APP_URL,
    title: `${APP_NAME}: Pakistan's eSports Tournaments & Gaming Platform`,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    images: [{
      url: `${APP_URL}/og-image.png`, // Assuming you will add an og-image.png to your /public folder
      width: 1200,
      height: 630,
      alt: `Logo and promotional banner for ${APP_NAME}, the ultimate eSports gaming arena.`,
    }],
  },

  // Twitter Card Metadata
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME}: Pakistan's eSports Tournaments & Gaming Platform`,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/og-image.png`], // Twitter uses the same image
    creator: "@YourTwitterHandle", // Replace with your actual Twitter handle if you have one
  },

  // Apple-specific metadata
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  
  // Other metadata
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#4B0082',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
         <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8948652329924345"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${orbitron.variable} ${poppins.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <FirebaseInitializer>
          <AuthProvider>
            <SettingsProvider>
              <UpdateProvider>
                <AdProvider>
                  <MiningProvider>
                    <FloatingChatProvider>
                        <AppShell>
                          {children}
                        </AppShell>
                        <CpuMiningDialog />
                    </FloatingChatProvider>
                  </MiningProvider>
                </AdProvider>
              </UpdateProvider>
            </SettingsProvider>
          </AuthProvider>
        </FirebaseInitializer>
        <Toaster />
        <LinkvertiseScript />
      </body>
    </html>
  );
}
