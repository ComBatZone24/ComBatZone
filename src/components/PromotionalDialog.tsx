
"use client";

import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import type { GlobalSettings, Tournament, ShopItem } from '@/types';
import Image from 'next/image';
import { getDisplayableBannerUrl, getYoutubeVideoId } from '@/lib/image-helper';
import { Loader2, X, ExternalLink } from 'lucide-react';
import GlassCard from './core/glass-card';
import Link from 'next/link';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import RupeeIcon from './core/rupee-icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type PromoPopupSettings = NonNullable<GlobalSettings['promoPopup']>;

const defaultSettings: PromoPopupSettings = {
  enabled: false,
  promoType: 'media',
  promoMediaUrl: '',
  promoMediaType: 'image',
  selectedItemId: null,
  displayLocation: 'homepage',
  promoTitle: '',
  promoDescription: '',
  promoButtonText: '',
  promoButtonLink: '',
};

const PromotionalDialog = () => {
  const { user } = useAuth();
  const pathname = usePathname();
  const [settings, setSettings] = useState<PromoPopupSettings | null>(null);
  const [promoContent, setPromoContent] = useState<Tournament | ShopItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Effect to fetch settings from Firebase
  useEffect(() => {
    try {
      const db = getDatabase();
      const settingsRef = ref(db, 'globalSettings/promoPopup');
      
      const unsubscribe = onValue(settingsRef, (snapshot) => {
        const fetchedSettings = snapshot.val();
        if (fetchedSettings) {
          setSettings({ ...defaultSettings, ...fetchedSettings });
        } else {
          setSettings(defaultSettings);
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching promo settings:", error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase DB not initialized for promo dialog.", error);
      setIsLoading(false);
    }
  }, []);

  // Effect to decide whether to show the dialog
  useEffect(() => {
    if (isLoading || !settings) {
      return; // Wait for settings to load
    }

    const hasSeenPromo = sessionStorage.getItem('promoDialogSeen') === 'true';

    // Conditions to NOT show the dialog
    if (
      hasSeenPromo ||
      !settings.enabled ||
      user?.role === 'admin' ||
      pathname.startsWith('/admin') ||
      (settings.displayLocation === 'homepage' && pathname !== '/')
    ) {
      setIsVisible(false);
      return;
    }

    // If all checks pass, prepare and show the dialog
    const showPromo = async () => {
      setPromoContent(null);
      // If it's a specific item, fetch its data
      if (settings.promoType !== 'media' && settings.selectedItemId) {
        const path = settings.promoType === 'tournament' ? 'tournaments' : 'shopItems';
        try {
          const db = getDatabase();
          const itemRef = ref(db, `${path}/${settings.selectedItemId}`);
          const snapshot = await get(itemRef);
          if (snapshot.exists()) {
            setPromoContent({ id: snapshot.key, ...snapshot.val() });
          } else {
             // If the linked item doesn't exist, don't show the promo
             console.warn(`Promo item ${settings.selectedItemId} not found in ${path}.`);
             return;
          }
        } catch (e) {
          console.error("Error fetching promo content item:", e);
          return; // Don't show promo if content fails to load
        }
      }
      
      // All good, show the dialog and mark it as seen for this session
      setIsVisible(true);
      sessionStorage.setItem('promoDialogSeen', 'true');
    };

    showPromo();

  }, [isLoading, settings, user, pathname]);

  const handleClose = () => {
    setIsVisible(false);
  };
  
  const renderContent = () => {
    switch (settings?.promoType) {
        case 'tournament':
            const tournament = promoContent as Tournament;
            return tournament ? (
                <div className="flex flex-col items-center gap-4 group w-full text-center">
                    <p className="text-sm text-accent font-semibold">FEATURED TOURNAMENT</p>
                    <div className="relative w-full aspect-video rounded-md overflow-hidden">
                         <Image src={getDisplayableBannerUrl(tournament.bannerImageUrl, tournament.game)} alt={tournament.name} fill style={{objectFit: 'cover'}} className="group-hover:scale-110 transition-transform duration-300"/>
                    </div>
                    <div className="w-full">
                        <h3 className="font-bold text-xl sm:text-2xl text-foreground mt-1">{tournament.name}</h3>
                        <p className="text-sm sm:text-md text-muted-foreground mt-1">{tournament.game} - {tournament.mode}</p>
                        <Button asChild className="mt-4 w-full neon-accent-bg"><Link href={`/tournaments/${tournament.id}`} onClick={handleClose}><ExternalLink className="mr-2 h-4 w-4"/>View Tournament</Link></Button>
                    </div>
                </div>
            ) : <Loader2 className="animate-spin h-8 w-8 text-accent m-auto"/>;
        case 'product':
             const item = promoContent as ShopItem;
            return item ? (
                <div className="flex flex-col items-center gap-4 group w-full text-center">
                    <p className="text-sm text-accent font-semibold">NEW IN SHOP</p>
                    <div className="relative w-full aspect-square rounded-md overflow-hidden">
                         <Image src={getDisplayableBannerUrl(item.imageUrl, item.name)} alt={item.name} fill style={{objectFit: 'cover'}} className="group-hover:scale-110 transition-transform duration-300"/>
                    </div>
                    <div className="w-full">
                        <h3 className="font-bold text-xl sm:text-2xl text-foreground mt-1">{item.name}</h3>
                         <p className="text-2xl font-bold text-accent flex items-center justify-center mt-2">
                            <RupeeIcon className="inline h-5 mr-0.5" />
                            {item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <Button asChild className="mt-4 w-full neon-accent-bg"><Link href="/shop" onClick={handleClose}><ExternalLink className="mr-2 h-4 w-4"/>Go to Shop</Link></Button>
                    </div>
                </div>
            ) : <Loader2 className="animate-spin h-8 w-8 text-accent m-auto"/>;
        case 'media':
        default:
            if (!settings) return null;
            const videoId = settings.promoType === 'media' && settings.promoMediaType === 'video' ? getYoutubeVideoId(settings.promoMediaUrl) : null;
            return (
                <div className="w-full text-center">
                     {settings.promoMediaUrl && (
                         <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black">
                            {videoId ? (
                                <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&autohide=1&modestbranding=1`} frameBorder="0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="Promotional Video"></iframe>
                            ) : (
                                <Image src={getDisplayableBannerUrl(settings.promoMediaUrl)} alt="Promotion" fill style={{ objectFit: 'contain' }} />
                            )}
                         </div>
                     )}
                     <div className="mt-4">
                        <h3 className="font-bold text-xl sm:text-2xl text-foreground mt-1">{settings.promoTitle || "Special Announcement"}</h3>
                        {settings.promoDescription && <p className="text-muted-foreground text-sm mt-2">{settings.promoDescription}</p>}
                        
                        {settings.promoButtonText && settings.promoButtonLink && (
                           <Button asChild className="mt-4 w-full neon-accent-bg">
                            <Link href={settings.promoButtonLink} onClick={handleClose}>
                                <ExternalLink className="mr-2 h-4 w-4"/>{settings.promoButtonText}
                            </Link>
                           </Button>
                        )}
                     </div>
                </div>
            );
    }
  };
  
  if (!isVisible) {
      return null;
  }

  return (
    <Dialog open={isVisible} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="glass-card sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="sr-only">Promotion</DialogTitle>
              <DialogDescription className="sr-only">A special announcement from ComBatZon.</DialogDescription>
            </DialogHeader>
            {renderContent()}
        </DialogContent>
    </Dialog>
  );
};

export default PromotionalDialog;
