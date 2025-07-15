
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { User as AppUserType, GlobalSettings, SellOrder, WalletTransaction, TokenTransaction } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo, runTransaction, push, update, serverTimestamp, onValue, off, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import RupeeIcon from '@/components/core/rupee-icon';
import { Loader2, Coins, AlertCircle, ShoppingCart, CircleHelp, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import GlassCard from '@/components/core/glass-card';

type TokenSettings = NonNullable<GlobalSettings['tokenSettings']>;

interface P2PMarketplaceProps {
  appUser: AppUserType;
  tokenSettings: TokenSettings;
}

export default function P2PMarketplace({ appUser, tokenSettings }: P2PMarketplaceProps) {
  const { toast } = useToast();
  
  // Create Order States
  const [sellAmount, setSellAmount] = useState<string>('');
  const [pricePerToken, setPricePerToken] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  // Market States
  const [marketOrders, setMarketOrders] = useState<SellOrder[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);


  const tokenWalletBalance = useMemo(() => {
    return appUser.tokenWallet || 0;
  }, [appUser.tokenWallet]);

  const marketFeePercent = useMemo(() => tokenSettings.marketFeePercent || 0, [tokenSettings.marketFeePercent]);
  
  const numericSellAmount = useMemo(() => parseFloat(sellAmount) || 0, [sellAmount]);
  const numericPricePerToken = useMemo(() => parseFloat(pricePerToken) || 0, [pricePerToken]);
  
  const { totalSaleValue, feeValue, finalPkrValue } = useMemo(() => {
    if (numericSellAmount > 0 && numericPricePerToken > 0) {
      const total = numericSellAmount * numericPricePerToken;
      const fee = total * (marketFeePercent / 100);
      const final = total - fee;
      return { 
        totalSaleValue: total,
        feeValue: fee, 
        finalPkrValue: final 
      };
    }
    return { totalSaleValue: 0, feeValue: 0, finalPkrValue: 0 };
  }, [numericSellAmount, numericPricePerToken, marketFeePercent]);

  useEffect(() => {
    const marketRef = query(ref(database, 'tokenMarketplace'), orderByChild('status'), equalTo('active'));
    const unsubscribe = onValue(marketRef, (snapshot) => {
        const orders: SellOrder[] = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                orders.push({ id: childSnapshot.key!, ...childSnapshot.val() });
            });
        }
        setMarketOrders(orders.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)));
        setIsLoadingMarket(false);
    }, (error) => {
        console.error("Error fetching marketplace orders:", error);
        toast({ title: "Market Error", description: "Could not load market orders.", variant: "destructive" });
        setIsLoadingMarket(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
 const handleCreateSellOrder = async () => {
    const numericSellAmountValue = parseFloat(sellAmount);
    const numericPricePerTokenValue = parseFloat(pricePerToken);

    if (!numericSellAmountValue || numericSellAmountValue <= 0) {
        toast({ title: "Invalid Amount", description: "Please enter a valid amount of tokens to sell.", variant: "destructive" });
        return;
    }
    if (!numericPricePerTokenValue || numericPricePerTokenValue <= 0) {
        toast({ title: "Invalid Price", description: "Please set a valid price per token.", variant: "destructive" });
        return;
    }
    
    setIsSubmittingOrder(true);
    
    try {
        const userRef = ref(database, `users/${appUser.id}`);
        const userSnap = await get(userRef);
        if (!userSnap.exists()) {
            throw new Error("Could not find your user data.");
        }
        const currentUserData = userSnap.val() as AppUserType;
        if ((currentUserData.tokenWallet || 0) < numericSellAmountValue) {
            throw new Error("Insufficient token balance. Please refresh.");
        }

        const updates: Record<string, any> = {};
        const newOrderKey = push(ref(database, 'tokenMarketplace')).key;
        if (!newOrderKey) throw new Error("Could not generate a unique order ID.");
        
        const newOrderData: Omit<SellOrder, 'id'> = {
            sellerId: appUser.id,
            sellerUsername: appUser.username,
            tokenAmount: numericSellAmountValue,
            pricePerToken: numericPricePerTokenValue,
            status: 'active',
            createdAt: serverTimestamp()
        };

        updates[`/users/${appUser.id}/tokenWallet`] = (currentUserData.tokenWallet || 0) - numericSellAmountValue;
        updates[`/tokenMarketplace/${newOrderKey}`] = newOrderData;
        
        await update(ref(database), updates);

        toast({ title: "Order Created!", description: "Your sell order has been listed on the marketplace.", className: "bg-green-500/20" });
        setSellAmount('');
        setPricePerToken('');

    } catch (error: any) {
        toast({ title: "Order Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmittingOrder(false);
    }
  }
  
  const handleBuyOrder = async (order: SellOrder) => {
    if (order.sellerId === appUser.id) {
        toast({ title: "Action Not Allowed", description: "You cannot buy your own sell order.", variant: "destructive" });
        return;
    }

    setProcessingOrderId(order.id);
    
    try {
        const buyerRef = ref(database, `users/${appUser.id}`);
        const sellerRef = ref(database, `users/${order.sellerId}`);
        const orderRef = ref(database, `tokenMarketplace/${order.id}`);
        const adminRef = tokenSettings.adminFeeWalletUid ? ref(database, `users/${tokenSettings.adminFeeWalletUid}`) : null;

        const [buyerSnap, sellerSnap, orderSnap, adminSnap] = await Promise.all([
            get(buyerRef), get(sellerRef), get(orderRef), adminRef ? get(adminRef) : Promise.resolve(null)
        ]);

        if (!orderSnap.exists() || orderSnap.val().status !== 'active') {
            throw new Error("This order is no longer available.");
        }
        if (!buyerSnap.exists() || !sellerSnap.exists()) {
            throw new Error("Could not find buyer or seller account.");
        }
        
        const buyerData = buyerSnap.val() as AppUserType;
        const sellerData = sellerSnap.val() as AppUserType;
        const adminData = adminSnap?.exists() ? adminSnap.val() as AppUserType : null;

        const totalPrice = order.tokenAmount * order.pricePerToken;
        if ((buyerData.wallet || 0) < totalPrice) {
            throw new Error("You do not have enough PKR in your wallet.");
        }

        const updates: Record<string, any> = {};
        const now = serverTimestamp();
        const nowISO = new Date().toISOString();
        const fee = totalPrice * (tokenSettings.marketFeePercent || 0) / 100;
        const sellerProceeds = totalPrice - fee;

        updates[`/users/${appUser.id}/wallet`] = (buyerData.wallet || 0) - totalPrice;
        updates[`/users/${appUser.id}/tokenWallet`] = (buyerData.tokenWallet || 0) + order.tokenAmount;
        updates[`/users/${order.sellerId}/wallet`] = (sellerData.wallet || 0) + sellerProceeds;
        if (fee > 0 && adminData && tokenSettings.adminFeeWalletUid) {
            updates[`/users/${tokenSettings.adminFeeWalletUid}/wallet`] = (adminData.wallet || 0) + fee;
        }

        updates[`/tokenMarketplace/${order.id}/status`] = 'completed';
        updates[`/tokenMarketplace/${order.id}/buyerId`] = appUser.id;
        updates[`/tokenMarketplace/${order.id}/buyerUsername`] = appUser.username;
        updates[`/tokenMarketplace/${order.id}/completedAt`] = now;

        const buyerTokenTxKey = push(ref(database, `tokenTransactions/${appUser.id}`)).key;
        updates[`/tokenTransactions/${appUser.id}/${buyerTokenTxKey}`] = { type: 'market_buy', amount: order.tokenAmount, description: `Bought from ${order.sellerUsername}`, date: now };
        
        const buyerWalletTxKey = push(ref(database, `walletTransactions/${appUser.id}`)).key;
        updates[`/walletTransactions/${appUser.id}/${buyerWalletTxKey}`] = { type: 'market_purchase', amount: -totalPrice, description: `Bought ${order.tokenAmount.toLocaleString()} ${tokenSettings.tokenSymbol} from ${order.sellerUsername}`, status: 'completed', date: nowISO };
        
        const sellerTokenTxKey = push(ref(database, `tokenTransactions/${order.sellerId}`)).key;
        updates[`/tokenTransactions/${order.sellerId}/${sellerTokenTxKey}`] = { type: 'market_sell', amount: -order.tokenAmount, description: `Sold to ${appUser.username}`, date: now };
        
        const sellerWalletTxKey = push(ref(database, `walletTransactions/${order.sellerId}`)).key;
        updates[`/walletTransactions/${order.sellerId}/${sellerWalletTxKey}`] = { type: 'market_sale_payout', amount: sellerProceeds, description: `Payout for selling ${order.tokenAmount.toLocaleString()} ${tokenSettings.tokenSymbol} to ${appUser.username}`, status: 'completed', date: nowISO };

        await update(ref(database), updates);

        toast({ title: "Purchase Successful!", description: `You bought ${order.tokenAmount.toLocaleString()} ${tokenSettings.tokenSymbol}.`, className: "bg-green-500/20" });

    } catch (error: any) {
        toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    } finally {
        setProcessingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string, tokenAmount: number) => {
    if (!orderId) return;
    setProcessingOrderId(orderId);
    try {
        const orderRef = ref(database, `tokenMarketplace/${orderId}`);
        const orderSnapshot = await get(orderRef);
        
        if (!orderSnapshot.exists() || orderSnapshot.val().sellerId !== appUser.id || orderSnapshot.val().status !== 'active') {
             throw new Error("This order cannot be cancelled. It might have been sold or already cancelled.");
        }

        const updates: Record<string, any> = {};
        const now = serverTimestamp();
        
        updates[`/tokenMarketplace/${orderId}`] = null;
        updates[`/users/${appUser.id}/tokenWallet`] = (appUser.tokenWallet || 0) + tokenAmount;
        
        const refundTxKey = push(ref(database, `tokenTransactions/${appUser.id}`)).key;
        updates[`/tokenTransactions/${appUser.id}/${refundTxKey}`] = { 
            type: 'market_cancel',
            amount: tokenAmount,
            description: `Refund from cancelled market order #${orderId.slice(-6)}`,
            date: now
        };

        await update(ref(database), updates);

        toast({ title: "Order Cancelled", description: "Your sell order has been removed and tokens returned to your wallet.", className: "bg-blue-500/20" });

    } catch (error: any) {
         toast({ title: "Cancellation Failed", description: error.message, variant: "destructive" });
    } finally {
         setProcessingOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
        <div className="p-4 rounded-lg bg-background/50 border border-border/50">
             <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2"><Coins className="text-accent"/>Create a Sell Order</h3>
             <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="sell-amount">Amount ({tokenSettings.tokenSymbol})</Label>
                             <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-accent"
                                onClick={() => setSellAmount(String(tokenWalletBalance))}
                            >
                                Use Max
                            </Button>
                        </div>
                        <Input 
                            id="sell-amount" 
                            type="text" 
                            inputMode="decimal" 
                            placeholder="0.0000" 
                            className="bg-input/50" 
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                         <div className="flex justify-between items-baseline">
                            <Label htmlFor="price-per-token">Price per Token (PKR)</Label>
                            {tokenSettings.basePrice > 0 && (
                                <button 
                                    type="button" 
                                    className="text-xs text-accent hover:underline"
                                    onClick={() => setPricePerToken(tokenSettings.basePrice.toLocaleString('en-US', {maximumFractionDigits: 12, useGrouping: false}))}
                                >
                                    Use Admin Price
                                </button>
                            )}
                        </div>
                        <Input 
                            id="price-per-token" 
                            type="text" 
                            inputMode="decimal"
                            placeholder="e.g., 0.001" 
                            className="bg-input/50"
                            value={pricePerToken} 
                            onChange={(e) => setPricePerToken(e.target.value)}
                        />
                    </div>
                 </div>
                 
                {numericSellAmount > 0 && numericPricePerToken > 0 && (
                    <Alert variant="default" className="mt-4 bg-muted/30 border-border/50 text-left p-4">
                        <AlertDescription asChild>
                            <div className="text-xs space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Total Sale Value</span>
                                    <span className="font-mono text-foreground">
                                        <RupeeIcon className="inline h-3.5" /> {totalSaleValue.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Marketplace Fee ({marketFeePercent || 0}%)</span>
                                    <span className="font-mono text-red-400">
                                        - <RupeeIcon className="inline h-3.5" /> {feeValue.toFixed(2)}
                                    </span>
                                </div>
                                <Separator className="my-2 bg-border/50"/>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="font-semibold text-foreground text-sm">Final Payout if Sold:</span>
                                    <span className="font-bold text-lg text-accent flex items-center gap-1">
                                        <RupeeIcon className="inline h-4 -mt-0.5"/> 
                                        {finalPkrValue.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
                
                <Button onClick={handleCreateSellOrder} className="w-full" disabled={isSubmittingOrder}>
                    {isSubmittingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Create Sell Order
                </Button>
             </div>
        </div>
        
        <Separator/>

        <div>
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2"><ShoppingCart className="text-accent"/>Active Market Orders</h3>
            <GlassCard className="p-0">
                <ScrollArea className="h-96">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Seller</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Price/Token</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingMarket ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-accent"/></TableCell></TableRow>
                            ) : marketOrders.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Marketplace is empty.</TableCell></TableRow>
                            ) : (
                                marketOrders.map(order => (
                                    <TableRow key={order.id} className="hover:bg-muted/20">
                                        <TableCell>{order.sellerUsername}</TableCell>
                                        <TableCell>{order.tokenAmount.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 8 })}</TableCell>
                                        <TableCell><RupeeIcon className="inline h-3.5"/> {order.pricePerToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 12 })}</TableCell>
                                        <TableCell>
                                            {order.sellerId === appUser.id ? (
                                                <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(order.id, order.tokenAmount)} disabled={!!processingOrderId}>
                                                    {processingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                                </Button>
                                            ) : (
                                                <Button size="sm" onClick={() => handleBuyOrder(order)} disabled={!!processingOrderId}>
                                                    {processingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : "Buy"}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </GlassCard>
        </div>
    </div>
  );
}
