
"use client";

import type React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import { bottomNavItems } from '@/config/nav';
import BottomNavigationBar from '@/components/layout/bottom-navigation-bar';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import FloatingChatWindow from '../tournaments/FloatingChatWindow';
import NotificationBell from '../notifications/NotificationBell';
import PullToRefresh from '../core/pull-to-refresh';
import CpuMiningDialog from '../games/CpuMiningDialog'; // Import the dialog

const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/forgot-password'];
const ADMIN_PATHS = ['/admin'];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: isAuthLoading } = useAuth();
  
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // This ensures that any client-side-only logic runs after hydration.
    setIsClient(true);

    const handleRefresh = () => {
        // This listens for the custom event from PullToRefresh
        // and uses Next.js's router.refresh() to re-fetch server
        // components and data without a full page reload.
        router.refresh();
    };

    window.addEventListener('custom-refresh', handleRefresh);

    return () => {
        window.removeEventListener('custom-refresh', handleRefresh);
    };

  }, [router]);

  const isAuthPath = AUTH_PATHS.some(path => pathname.startsWith(path));
  const isAdminArea = ADMIN_PATHS.some(path => pathname.startsWith(path));

  if (isAdminArea || isAuthPath) {
    return <>{children}</>;
  }

  // The bottom nav is only shown on the client side after authentication state is resolved and a user exists.
  // This prevents server/client mismatch (hydration errors).
  const showBottomNav = isClient && !isAuthLoading && user;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header isLoadingAuth={isAuthLoading} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        <div className="container mx-auto">
          {children}
        </div>
      </main>
      
      {isClient && <PullToRefresh />}
      
      {showBottomNav && (
        <BottomNavigationBar items={bottomNavItems} user={user} isLoading={isAuthLoading} />
      )}
      
      <FloatingChatWindow />
      {/* Render the mining dialog here so it's part of the main app shell */}
      <CpuMiningDialog />
    </div>
  );
};

export default AppShell;
