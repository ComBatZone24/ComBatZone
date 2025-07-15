import type { Metadata } from 'next';
import { Orbitron, Poppins } from 'next/font/google'; // Import Poppins
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
import Script from 'next/script';

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

export const metadata: Metadata = {
  title: 'Arena Ace',
  description: 'Join Arena Ace for eSports tournaments, manage your wallet, and climb the leaderboard.',
  manifest: '/manifest.webmanifest',
  themeColor: '#4B0082',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Arena Ace',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${poppins.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <FirebaseInitializer>
          <AuthProvider>
            <SettingsProvider>
                <AdProvider>
                  <FloatingChatProvider>
                    <AppShell>
                      {children}
                    </AppShell>
                  </FloatingChatProvider>
                  <Toaster />
                  <PromotionalDialog />
                  <DailyRewardManager />
                </AdProvider>
            </SettingsProvider>
          </AuthProvider>
        </FirebaseInitializer>
      </body>
    </html>
  );
}
