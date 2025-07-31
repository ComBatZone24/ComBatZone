
"use client";
import { Users, Truck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { LayoutDashboard, LogOut, UserCircle, Wallet, Loader2, Gamepad2, MessagesSquare } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import AppLogo from '@/components/core/AppLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { bottomNavItems } from '@/config/nav';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  isLoadingAuth: boolean;
}

const UserNav = ({ isLoadingAuth }: { isLoadingAuth: boolean }) => {
  const { user: appUser } = useAuth(); // Use the central auth context
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      window.location.assign('/auth/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        title: "Logout Failed",
        description: "Could not log you out completely. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoadingAuth) {
    return <Loader2 className="h-6 w-6 animate-spin text-accent" />;
  }

  if (!appUser) {
    return (
      <Button asChild className="neon-accent-bg text-sm h-9">
        <Link href="/auth/login">Login / Sign Up</Link>
      </Button>
    );
  }

  const displayName = appUser?.username || "User";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <NotificationBell />

      <Button variant="ghost" size="sm" className="px-2 sm:px-3 h-9 hover:bg-accent/10" asChild>
        <Link href="/wallet">
          <Wallet className="h-5 w-5 text-accent shrink-0"/>
          <span className="hidden sm:inline-flex items-center ml-2">
              <RupeeIcon className="inline h-3.5 -mt-0.5 mr-0.5" />
              <span className="font-semibold text-foreground">{appUser.wallet?.toFixed(2) || '0.00'}</span>
          </span>
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10 text-accent">
                <AvatarImage src={appUser.avatarUrl || undefined} alt={displayName} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 glass-card" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{appUser.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(appUser.role === 'admin' || appUser.role === 'delegate') && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/admin/dashboard" className="cursor-pointer"><LayoutDashboard className="mr-2 h-4 w-4" /><span>Admin Panel</span></Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer"><UserCircle className="mr-2 h-4 w-4" /><span>Profile</span></Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wallet" className="cursor-pointer"><Wallet className="mr-2 h-4 w-4" /><span>Wallet</span></Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ isLoadingAuth }) => {
    const pathname = usePathname();
    const { settings } = useSettings();
    const { user } = useAuth(); 

    const finalFilteredItems = useMemo(() => {
        const cryptoIsEnabled = settings?.tokenSettings?.enabled === true;
        const spinWheelIsEnabled = settings?.spinWheelSettings?.enabled === true;
        const dragonTigerIsEnabled = settings?.dragonTigerSettings?.enabled === true;
        const chatIsEnabled = settings?.globalChatEnabled === true;
        return bottomNavItems.filter(item => {
            if (item.href === '/crypto') return cryptoIsEnabled;
            if (item.href === '/spin-wheel') return spinWheelIsEnabled;
            if (item.href === '/dragon-tiger') return dragonTigerIsEnabled;
            if (item.href === '/global-chat') return chatIsEnabled;
            return true;
        });
    }, [settings]);

    const appName = settings?.appName || 'ComBatZon';
    const appLogoUrl = settings?.appLogoUrl || '';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg flex">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4 h-full">
            <AppLogo appName={appName} appLogoUrl={appLogoUrl} textClassName="sm:text-xl"/>
             <nav className="hidden md:flex items-center space-x-2 lg:space-x-4">
              {user && finalFilteredItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                      <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                              isActive ? "bg-accent/20 text-accent-foreground" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                          )}
                      >
                          {item.title}
                      </Link>
                  );
              })}
            </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4"><UserNav isLoadingAuth={isLoadingAuth} /></div>
      </div>
    </header>
  );
};

export default Header;
