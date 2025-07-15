
"use client";

import React, { useEffect, useRef } from 'react';
import type { PromoPost } from '@/types';
import { Button } from '../ui/button';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollingBannerProps {
  banners: PromoPost[];
}

const ScrollingBanner: React.FC<ScrollingBannerProps> = ({ banners }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    
    scroller.setAttribute("data-animated", "true");
    const scrollerInner = scroller.querySelector('.scroller__inner');
    if (scrollerInner) {
        // Clear previous content to avoid multiple duplications on re-render
        const originalContent = Array.from(scrollerInner.children).filter(
            (child) => !child.hasAttribute('aria-hidden')
        );

        // Remove old duplicates
        scrollerInner.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());

        // Re-duplicate content
        originalContent.forEach(item => {
            const duplicatedItem = item.cloneNode(true) as HTMLElement;
            duplicatedItem.setAttribute("aria-hidden", "true");
            scrollerInner.appendChild(duplicatedItem);
        });
    }

  }, [banners]); // Rerun effect if banners change

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <>
      <style jsx>{`
        .scroller {
          max-width: 100%;
          overflow: hidden;
          -webkit-mask: linear-gradient(90deg, transparent, white 20%, white 80%, transparent);
          mask: linear-gradient(90deg, transparent, white 20%, white 80%, transparent);
        }
        .scroller__inner {
          display: flex;
          gap: 1.5rem; /* 24px */
          flex-wrap: nowrap;
          width: max-content;
          animation: scroll 60s linear infinite; /* Slowed down from 30s to 60s */
        }
        @keyframes scroll {
          to {
            transform: translate(calc(-50% - 0.75rem));
          }
        }
      `}</style>
      <div className="scroller glass-card py-2 px-4 rounded-lg" ref={scrollerRef}>
        <div className="scroller__inner">
          {banners.map((banner, index) => (
            <div key={`${banner.id}-${index}`} className="flex items-center gap-3 text-sm text-foreground flex-shrink-0">
               <Megaphone className="h-5 w-5 text-accent flex-shrink-0"/>
               <strong className="font-semibold text-red-500">{banner.title}:</strong> {/* Made text red and bold */}
               <p className="text-muted-foreground">{banner.description}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ScrollingBanner;
