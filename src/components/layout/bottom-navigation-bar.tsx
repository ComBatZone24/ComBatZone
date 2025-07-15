
"use client";

import type React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/config/nav';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAd } from '@/context/AdContext';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '../ui/button';
import type { User as AppUserType } from '@/types';

interface BottomNavigationBarProps {
  items: NavItem[];
  user: AppUserType | null; 
  isLoading: boolean;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ items, user, isLoading }) => {
  const pathname = usePathname();
  const router = useRouter(); // Import and use the router for navigation
  const { triggerButtonAd } = useAd();
  const { settings, isLoadingSettings } = useSettings();
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const finalFilteredItems = useMemo(() => {
    let baseItems = items;
    if (user && user.role === 'delegate' && pathname.startsWith('/delegate-panel')) {
      baseItems = items.filter(item => {
        const cleanHref = item.href.replace(/^[/]+|[/]+$/g, '');
        return Array.isArray(user.accessScreens) && user.accessScreens.includes(cleanHref);
      });
    }

    if(isLoadingSettings || !settings) {
        return baseItems;
    }

    const cryptoIsEnabled = settings?.tokenSettings?.enabled === true;
    const spinWheelIsEnabled = settings?.spinWheelSettings?.enabled === true;
    const dragonTigerIsEnabled = settings?.dragonTigerSettings?.enabled === true;
    const chatIsEnabled = settings?.globalChatEnabled === true;
    const shopIsEnabled = settings?.shopEnabled === true;

    return baseItems.filter(item => {
      if (item.href === '/crypto') return cryptoIsEnabled;
      if (item.href === '/spin-wheel') return spinWheelIsEnabled;
      if (item.href === '/dragon-tiger') return dragonTigerIsEnabled;
      if (item.href === '/global-chat') return chatIsEnabled;
      if (item.href === '/shop') return shopIsEnabled;
      return true;
    });
  }, [items, user, pathname, settings, isLoadingSettings]);
  
  const checkScrollability = () => {
    const viewport = viewportRef.current;
    if (viewport) {
      setCanScrollLeft(viewport.scrollLeft > 5);
      setCanScrollRight(viewport.scrollWidth > viewport.clientWidth + viewport.scrollLeft + 5);
    }
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      checkScrollability();
      viewport.addEventListener('scroll', checkScrollability, { passive: true });
      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(viewport);

      return () => {
        viewport.removeEventListener('scroll', checkScrollability);
        resizeObserver.disconnect();
      };
    }
  }, [finalFilteredItems]);
  
  if (isLoading || !user) {
      return null;
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border/60 bg-background/90 backdrop-blur-lg md:hidden">
      <div className="relative w-full h-full">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-r from-background to-transparent pr-4 pointer-events-none">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </div>
        )}
        <ScrollArea className="w-full whitespace-nowrap h-full" viewportRef={viewportRef}>
          <div className="flex w-max space-x-2 px-4 h-full items-center">
            {finalFilteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const placementId = `nav_${item.href.substring(1).replace('/', '-') || 'home'}`;

              const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  
                  // Navigate immediately for a responsive feel
                  router.push(item.href);
                  
                  // Trigger the ad logic in the background without blocking navigation
                  triggerButtonAd(() => {}, placementId); 
              };

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={handleNavigation}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md text-muted-foreground hover:text-accent transition-colors min-w-[70px]",
                    isActive && "text-accent"
                  )}
                >
                  <Icon className={cn("h-6 w-6 shrink-0", isActive ? "text-accent" : "")} />
                  <span className={cn("text-xs mt-1 truncate", isActive ? "font-medium" : "")}>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-l from-background to-transparent pl-4 pointer-events-none">
            <ChevronRight className="h-5 w-5 text-foreground" />
          </div>
        )}
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
