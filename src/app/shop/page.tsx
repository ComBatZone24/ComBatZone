
"use client";

import { useState, useEffect, useMemo } from 'react';
import { database, auth } from '@/lib/firebase/config';
import { ref, onValue, off, get } from 'firebase/database';
import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { ShoppingCart, PackageSearch, CreditCard, AlertCircle, TicketPercent, ShieldQuestion } from 'lucide-react';
import Image from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import RupeeIcon from '@/components/core/rupee-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisplayableBannerUrl, generateDataAiHint } from '@/lib/image-helper';
import type { ShopItem, User as AppUserType, Coupon, GlobalSettings } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import BuyNowDialog from '@/components/shop/buy-now-dialog';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/context/SettingsContext';


const dummyShopItems: ShopItem[] = [
  { id: 'dummy1', name: 'Arena Ace Pro Jersey (RTDB)', price: 1299, imageUrl: 'https://placehold.co/400x300.png?text=Pro+Jersey', description: 'High-performance gaming jersey, breathable fabric.', category: 'Apparel', stock: 50, active: true },
  { id: 'dummy2', name: 'Stealth Gaming Mouse (RTDB)', price: 2499, imageUrl: 'https://placehold.co/400x300.png?text=Gaming+Mouse', description: 'Precision gaming mouse with customizable RGB lighting.', category: 'Peripherals', stock: 30, active: true },
];

const ShopItemCardSkeleton: React.FC = () => (
  <GlassCard className="flex flex-col overflow-hidden">
    <Skeleton className="w-full aspect-[4/3] bg-muted/50" />
    <div className="p-4 flex flex-col flex-grow">
      <Skeleton className="h-6 w-3/4 mb-2 bg-muted/50" />
      <Skeleton className="h-8 w-1/2 mb-3 bg-muted/50" />
      <Skeleton className="h-10 w-full mt-auto bg-muted/50" />
    </div>
  </GlassCard>
);

export default function ShopPage() {
  const { settings, isLoadingSettings } = useSettings();
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<{item: ShopItem, coupon: Coupon | null} | null>(null);
  const [isBuyNowDialogOpen, setIsBuyNowDialogOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUserType | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
        setIsAuthLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && database) {
        const userProfileRef = ref(database, `users/${user.uid}`);
        try {
          const snapshot = await get(userProfileRef);
          if (snapshot.exists()) {
            setAppUser({ id: user.uid, ...snapshot.val() } as AppUserType);
          } else {
            setAppUser(null);
          }
        } catch (dbError) {
          console.error("Error fetching user profile for shop:", dbError);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!database) {
      setError("Database service is not available.");
      setLoading(false);
      setShopItems(dummyShopItems);
      return;
    }

    const itemsRef = ref(database, 'shopItems');
    const itemsListener = onValue(itemsRef, (snapshot) => {
      const loadedItems: ShopItem[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(id => {
          if (data[id].active) {
            loadedItems.push({ id, ...data[id] });
          }
        });
      }
      setShopItems(loadedItems);
      if (loadedItems.length === 0) {
        setError(null); // No error if DB is just empty
      }
      setLoading(false);
    }, (dbError) => {
      setError("Failed to load products. Displaying placeholders.");
      setShopItems(dummyShopItems);
      setLoading(false);
    });

    const couponsRef = ref(database, 'coupons');
    const couponsListener = onValue(couponsRef, (snapshot) => {
        const loadedCoupons: Coupon[] = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(id => {
                const coupon = data[id];
                if (coupon.isActive && new Date(coupon.expiryDate) > new Date() && new Date(coupon.startDate) <= new Date()) {
                    loadedCoupons.push({ id, ...data[id] });
                }
            });
        }
        setCoupons(loadedCoupons);
    }, (dbError) => {
        console.error("Error fetching coupons:", dbError);
    });

    return () => {
      off(itemsRef, 'value', itemsListener);
      off(couponsRef, 'value', couponsListener);
    };
  }, []);
  
  const fullShopCoupons = useMemo(() => coupons.filter(c => c.appliesTo === 'full_shop'), [coupons]);
  const itemCouponsMap = useMemo(() => {
    const map = new Map<string, Coupon>();
    coupons.filter(c => c.appliesTo === 'per_item' && c.applicableItemIds).forEach(c => {
      c.applicableItemIds!.forEach(itemId => {
        if (!map.has(itemId)) { // Prioritize the first coupon found for an item
            map.set(itemId, c);
        }
      });
    });
    return map;
  }, [coupons]);

  const handleBuyNowClick = (item: ShopItem, coupon: Coupon | null) => {
    if (!firebaseUser) {
    }
    setSelectedItemForPurchase({item, coupon});
    setIsBuyNowDialogOpen(true);
  };

  const itemsToDisplay = error ? dummyShopItems : shopItems;

  const isShopEnabled = settings?.shopEnabled === true;
  
  if (isLoadingSettings) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ShopItemCardSkeleton key={index} />
          ))}
        </div>
      );
  }

  if (!isShopEnabled) {
      return (
        <GlassCard className="mt-8 p-8 text-center max-w-md mx-auto">
            <ShieldQuestion className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Shop Unavailable</h2>
            <p className="text-muted-foreground">The shop is currently unavailable. Please check back later.</p>
        </GlassCard>
      );
  }

  return (
    <div className="container mx-auto py-8">
      
      {error && !loading && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Loading Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {fullShopCoupons.length > 0 && (
          <GlassCard className="mb-8 p-6 bg-accent/20 border-accent/50 text-center">
            <TicketPercent className="mx-auto h-12 w-12 text-accent mb-3" />
            <h2 className="text-2xl font-bold text-accent">Special Offer!</h2>
            {fullShopCoupons.map(coupon => (
                 <p key={coupon.id} className="text-foreground">
                    Use code <strong className="font-mono bg-background/50 px-1.5 py-0.5 rounded">{coupon.code}</strong> at checkout for 
                    <strong> {coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `Rs ${coupon.discountValue} off`} your entire purchase!</strong>
                </p>
            ))}
          </GlassCard>
      )}
      
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ShopItemCardSkeleton key={index} />
          ))}
        </div>
      ) : itemsToDisplay.length === 0 && !error ? ( 
        <GlassCard className="py-10 text-center">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-xl text-muted-foreground">The shop is currently empty. Check back soon!</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {itemsToDisplay.map((item, index) => {
            const itemSpecificCoupon = itemCouponsMap.get(item.id);
            const applicableCoupon = itemSpecificCoupon || (fullShopCoupons.length > 0 ? fullShopCoupons[0] : null);

            let discountedPrice = item.price;
            if(applicableCoupon){
                if(applicableCoupon.discountType === 'percentage'){
                    discountedPrice = item.price * (1 - applicableCoupon.discountValue / 100);
                } else {
                    discountedPrice = Math.max(0, item.price - applicableCoupon.discountValue);
                }
            }
            
            const displayableImageUrl = item.imageUrl ? getDisplayableBannerUrl(item.imageUrl, item.name) : 'https://placehold.co/400x300.png?text=Image+Missing';
            const aiHint = generateDataAiHint(item.imageUrl, item.name);
            const isOutOfStock = item.stock <= 0;
            
            return (
              <GlassCard 
                key={item.id || `dummy-${index}`} 
                className={`flex flex-col overflow-hidden group border border-border/30 transition-all duration-300 ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-accent/20 hover:border-accent/50'}`}
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <Image
                    src={displayableImageUrl}
                    alt={item.name}
                    fill
                    style={{ objectFit: 'cover' }}
                    className="transition-transform duration-500 ease-in-out group-hover:scale-110"
                    data-ai-hint={aiHint}
                    priority={index < 4}
                  />
                  {applicableCoupon && !isOutOfStock && (
                    <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground shadow-lg">
                      {applicableCoupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `SALE`}
                    </Badge>
                  )}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <p className="text-white font-bold text-xl border-2 border-white/50 px-4 py-2 rounded-md bg-black/50">OUT OF STOCK</p>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow bg-card/70">
                  <h3 className={`text-lg font-semibold text-foreground mb-1 truncate ${!isOutOfStock ? 'group-hover:text-accent transition-colors' : ''}`}>{item.name}</h3>
                  
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-xl font-bold text-accent flex items-center">
                        <RupeeIcon className="inline h-5 mr-0.5" />
                        {discountedPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                    {applicableCoupon && (
                        <p className="text-sm text-muted-foreground line-through">
                           <RupeeIcon className="inline h-3.5"/>{item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                    )}
                  </div>

                  <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="w-fit mb-2">
                    {isOutOfStock ? 'Out of Stock' : `${item.stock} in stock`}
                  </Badge>
                  
                  {item.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-grow">{item.description}</p>}
                  <Button
                    className="w-full mt-auto neon-accent-bg text-accent-foreground disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:cursor-not-allowed"
                    onClick={() => handleBuyNowClick(item, applicableCoupon)}
                    disabled={isAuthLoading || isOutOfStock}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" /> 
                    {isOutOfStock ? "Out of Stock" : "Buy Now"}
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
      {selectedItemForPurchase && (
        <Dialog open={isBuyNowDialogOpen} onOpenChange={setIsBuyNowDialogOpen}>
          <DialogContent className="glass-card sm:max-w-lg">
            {!firebaseUser ? (
              <div className="p-6 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h3>
                    <p className="text-muted-foreground mb-6">Please log in or sign up to purchase items from the shop.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild className="w-full sm:w-auto neon-accent-bg">
                            <Link href="/auth/login">Login</Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full sm:w-auto">
                            <Link href="/auth/signup">Sign Up</Link>
                        </Button>
                    </div>
                </div>
            ) : !appUser ? (
              <div className="p-6 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Profile Error</h3>
                    <p className="text-muted-foreground mb-6">We couldn't load your profile details. Please try refreshing the page or contact support.</p>
                 </div>
            ) : (
                <BuyNowDialog
                    item={selectedItemForPurchase.item}
                    coupon={selectedItemForPurchase.coupon}
                    firebaseUser={firebaseUser}
                    appUser={appUser}
                    onOpenChange={setIsBuyNowDialogOpen}
                />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
