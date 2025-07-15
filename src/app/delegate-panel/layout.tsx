"use client";

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/config/nav';
import { useAuth } from '@/context/AuthContext';

interface BottomNavigationBarProps {
  items: NavItem[];
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ items }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredItems = user && user.role === 'delegate' && pathname.startsWith('/delegate-panel')
    ? items.filter(item => {
        const cleanHref = item.href.replace(/^[/]+|[/]+$/g, '');
        // Ensure accessScreens is treated as an array
        return Array.isArray(user.accessScreens) && user.accessScreens.includes(cleanHref);
      })
    : items;

  if (!items?.length) {
    return null;
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border/60 bg-background/90 backdrop-blur-lg">
      <div className="flex h-full items-center justify-around">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-md text-muted-foreground hover:text-accent transition-colors w-full max-w-[calc(100%/6)]",
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
    </nav>
  );
};

export default BottomNavigationBar;