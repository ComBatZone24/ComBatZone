
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { User as AppUserType, GlobalSettings, TokenTransaction, WalletTransaction } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo, runTransaction, push, update, serverTimestamp, onValue, off, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import RupeeIcon from '@/components/core/rupee-icon';
import { Loader2, ArrowRightLeft, Send, Repeat, BarChart2, Coins, AlertCircle, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import TokenTransactionList from './TokenTransactionList';
import P2PMarketplace from './P2PMarketplace';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';

type TokenSettings = NonNullable<GlobalSettings['tokenSettings']>;

interface CryptoWalletProps {
  appUser: AppUserType;
  tokenSettings: TokenSettings;
}

export default function CryptoWallet({ appUser, tokenSettings }: CryptoWalletProps) {
  const { toast } = useToast();
  const { user: authUser } = useAuth(); // Use auth context
  
  const enabledTabs = useMemo(() => {
    const tabs = [];
    if (tokenSettings.buyEnabled) tabs.push({ key: 'buy', label: 'Buy' });
    if (tokenSettings.sellEnabled) tabs.push({ key: 'sell', label: 'Sell' });
    if (tokenSettings.marketplaceEnabled) tabs.push({ key: 'marketplace', label: 'Marketplace' });
    return tabs;
  }, [tokenSettings.buyEnabled, tokenSettings.sellEnabled, tokenSettings.marketplaceEnabled]);

  const defaultTab = enabledTabs.length > 0 ? enabledTabs[0].key : 'buy';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  const [pkrAmount, setPkrAmount] = useState<string>('');
  const [tokenAmount, setTokenAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Use appUser directly as it's kept live by the parent (CryptoPage)
  const localAppUser = appUser; 

  const currentPrice = tokenSettings.basePrice || 0;
  
  const tokenWalletBalance = useMemo(() => localAppUser.tokenWallet || 0, [localAppUser.tokenWallet]);

  const pkrValue = useMemo(() => {
    return tokenWalletBalance * currentPrice;
  }, [tokenWalletBalance, currentPrice]);

  const { grossValue, feeValue, netPkrValue } = useMemo(() => {
    if (activeTab !== 'sell') return { grossValue: 0, feeValue: 0, netPkrValue: 0 };
    
    const tokens = parseFloat(tokenAmount);
    if (isNaN(tokens) || tokens <= 0 || !currentPrice) {
      return { grossValue: 0, feeValue: 0, netPkrValue: 0 };
    }

    const gross = tokens * currentPrice;
    const fee = gross * ((tokenSettings.sellFeePercent || 0) / 100);
    const net = gross - fee;

    return { grossValue: gross, feeValue: fee, netPkrValue: net };
  }, [tokenAmount, currentPrice, tokenSettings.sellFeePercent, activeTab]);

  const handleAmountChange = (field: 'pkr' | 'token', value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        return; // Prevent non-numeric input
    }

    const numericValue = parseFloat(value);
    
    if (field === 'pkr') {
        setPkrAmount(value);
        if (!isNaN(numericValue) && numericValue > 0 && currentPrice > 0) {
            let calculatedTokens;
            if (activeTab === 'buy') {
                calculatedTokens = numericValue / currentPrice;
            } else {
                const feePercent = (tokenSettings.sellFeePercent || 0) / 100;
                const grossPkrValue = numericValue / (1 - feePercent);
                calculatedTokens = grossPkrValue / currentPrice;
            }
            setTokenAmount(calculatedTokens.toLocaleString('en-US', { maximumFractionDigits: 20, useGrouping: false }));
        } else {
            setTokenAmount('');
        }
    } else { // field === 'token'
        setTokenAmount(value);
        if (!isNaN(numericValue) && numericValue > 0 && currentPrice > 0) {
            let calculatedPkr;
            if (activeTab === 'buy') {
                calculatedPkr = numericValue * currentPrice;
            } else {
                const feePercent = (tokenSettings.sellFeePercent || 0) / 100;
                calculatedPkr = (numericValue * currentPrice) * (1 - feePercent);
            }
            const formattedPkr = calculatedPkr > 0 
                ? calculatedPkr.toLocaleString('en-US', {maximumFractionDigits: 2, useGrouping: false})
                : '';
            setPkrAmount(formattedPkr);
        } else {
            setPkrAmount('');
        }
    }
  };

  const handleUseMax = () => {
    const fullDecimalTokens = tokenWalletBalance.toLocaleString('en-US', { maximumFractionDigits: 20, useGrouping: false });
    setTokenAmount(fullDecimalTokens);

    if (tokenWalletBalance > 0 && currentPrice > 0) {
        const feePercent = (tokenSettings.sellFeePercent || 0) / 100;
        const calculatedPkr = (tokenWalletBalance * currentPrice) * (1 - feePercent);
        const formattedPkr = calculatedPkr > 0 
            ? calculatedPkr.toLocaleString('en-US', {maximumFractionDigits: 2, useGrouping: false})
            : '';
        setPkrAmount(formattedPkr);
    } else {
        setPkrAmount('');
    }
  };


  const updateEconomy = async (amount: number, type: 'buy' | 'sell') => {
    try {
        const economyRef = ref(database, 'tokenEconomyData');
        
        await runTransaction(economyRef, (currentEconomy) => {
            if (!currentEconomy) {
                return {
                    circulatingSupply: type === 'buy' ? amount : -amount,
                    volumeSinceLastAdjustment: amount,
                };
            }

            const newCirculatingSupply = type === 'buy' 
                ? (currentEconomy.circulatingSupply || 0) + amount
                : (currentEconomy.circulatingSupply || 0) - amount;
            
            currentEconomy.circulatingSupply = newCirculatingSupply;
            currentEconomy.volumeSinceLastAdjustment = (currentEconomy.volumeSinceLastAdjustment || 0) + amount;

            return currentEconomy;
        });

    } catch (error) {
        console.error("Failed to update economy data:", error);
    }
  };

const handleBuyTransaction = async () => {
    const pkrToSpend = pkrAmount ? parseFloat(pkrAmount) : 0;
    const tokensToReceive = tokenAmount ? parseFloat(tokenAmount) : 0;

    if (pkrToSpend <= 0 || tokensToReceive <= 0) {
        toast({ title: "Invalid Amount", description: "Please enter a valid amount to spend.", variant: "destructive" });
        return;
    }
    
    setIsProcessing(true);

    try {
        const userRef = ref(database, `users/${localAppUser.id}`);
        const transactionResult = await runTransaction(userRef, (currentUserData: AppUserType | null) => {
            if (!currentUserData) {
                console.error("Buy Transaction: User data is null. Aborting.");
                return; 
            }
            if ((currentUserData.wallet || 0) < pkrToSpend) {
                console.warn(`Buy Transaction: Insufficient funds on server. Wallet: ${currentUserData.wallet}, Needed: ${pkrToSpend}. Aborting.`);
                return; 
            }
            
            currentUserData.wallet = (currentUserData.wallet || 0) - pkrToSpend;
            currentUserData.tokenWallet = (currentUserData.tokenWallet || 0) + tokensToReceive;
            return currentUserData;
        });

        if (!transactionResult.committed) {
            throw new Error("Transaction failed. Your wallet balance might be too low. Please refresh.");
        }

        const nowISO = new Date().toISOString();
        const nowTimestamp = serverTimestamp();
        
        const updates: Record<string, any> = {};

        const walletTxKey = push(ref(database, `walletTransactions/${localAppUser.id}`)).key;
        updates[`/walletTransactions/${localAppUser.id}/${walletTxKey}`] = {
            type: 'token_purchase', amount: -pkrToSpend, status: 'completed',
            date: nowISO, description: `Purchase of ${tokensToReceive.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: false })} ${tokenSettings.tokenSymbol}`
        } as Omit<WalletTransaction, 'id'>;
        
        const tokenTxKey = push(ref(database, `tokenTransactions/${localAppUser.id}`)).key;
        updates[`/tokenTransactions/${localAppUser.id}/${tokenTxKey}`] = {
            userId: localAppUser.id, type: 'buy_from_admin', amount: tokensToReceive, pkrValue: pkrToSpend,
            description: `Bought ${tokensToReceive.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: false })} ${tokenSettings.tokenSymbol}`,
            date: nowTimestamp
        } as Omit<TokenTransaction, 'id'>;
        
        await update(ref(database), updates);
        await updateEconomy(tokensToReceive, 'buy');

        toast({ title: "Transaction Successful!", description: `Bought ${tokensToReceive.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })} ${tokenSettings.tokenSymbol}`, className: 'bg-green-500/20' });
        
        setPkrAmount('');
        setTokenAmount('');

    } catch (error: any) {
        toast({ title: "Transaction Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
};

  const handleSellTransaction = async () => {
    const tokensToSellNum = parseFloat(tokenAmount);
    
    if (isNaN(tokensToSellNum) || tokensToSellNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount of tokens to sell.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const sellerRef = ref(database, `users/${appUser.id}`);
      const adminRef = tokenSettings.adminFeeWalletUid ? ref(database, `users/${tokenSettings.adminFeeWalletUid}`) : null;

      const [sellerSnap, adminSnap] = await Promise.all([get(sellerRef), adminRef ? get(adminRef) : null]);
      if (!sellerSnap.exists()) throw new Error("Could not find your user data.");
      
      const sellerData = sellerSnap.val() as AppUserType;
      const adminData = adminSnap?.exists() ? adminSnap.val() as AppUserType : null;

      if ((sellerData.tokenWallet || 0) < tokensToSellNum) {
        throw new Error("Insufficient token balance. Please refresh.");
      }

      const grossPkrValue = tokensToSellNum * currentPrice;
      const feeAmount = grossPkrValue * ((tokenSettings.sellFeePercent || 0) / 100);
      const netPkrToReceiveRaw = grossPkrValue - feeAmount;
      const netPkrToReceiveFinal = parseFloat(netPkrToReceiveRaw.toFixed(2));

      const updates: Record<string, any> = {};
      const now = serverTimestamp();
      const nowISO = new Date().toISOString();

      updates[`/users/${appUser.id}/tokenWallet`] = (sellerData.tokenWallet || 0) - tokensToSellNum;
      updates[`/users/${appUser.id}/wallet`] = (sellerData.wallet || 0) + netPkrToReceiveFinal;
      if (feeAmount > 0 && adminData && tokenSettings.adminFeeWalletUid) {
        updates[`/users/${tokenSettings.adminFeeWalletUid}/wallet`] = (adminData.wallet || 0) + feeAmount;
      }
      
      const tokenTxKey = push(ref(database, `tokenTransactions/${appUser.id}`)).key;
      updates[`/tokenTransactions/${appUser.id}/${tokenTxKey}`] = {
          userId: appUser.id, type: 'sell_to_admin', amount: -tokensToSellNum, pkrValue: netPkrToReceiveFinal,
          description: `Sold ${tokensToSellNum.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })} ${tokenSettings.tokenSymbol}`,
          date: now
      };
      
      const walletTxKey = push(ref(database, `walletTransactions/${appUser.id}`)).key;
      updates[`/walletTransactions/${appUser.id}/${walletTxKey}`] = {
          type: 'token_sale_payout', amount: netPkrToReceiveFinal, status: 'completed',
          date: nowISO, description: `Payout for selling ${tokensToSellNum.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })} ${tokenSettings.tokenSymbol}`
      };

      await update(ref(database), updates);
      await updateEconomy(tokensToSellNum, 'sell');
      
      toast({ 
        title: "Sell Order Completed", 
        description: `You sold tokens. Rs ${netPkrToReceiveFinal.toFixed(2)} has been added to your wallet.`,
        className: 'bg-green-500/20' 
      });
      
      setPkrAmount('');
      setTokenAmount('');

    } catch (error: any) {
        toast({ title: "Sell Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  if (enabledTabs.length === 0) {
    return (
        <GlassCard className="p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Token Trading Disabled</h3>
            <p className="text-sm text-muted-foreground">All trading features for this token are currently disabled by the administrator.</p>
        </GlassCard>
    );
  }


  return (
    <div className="space-y-8">
        <GlassCard className="p-0 overflow-hidden shadow-xl border-2 border-accent/30 hover:shadow-accent/50 transition-shadow duration-300">
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Image 
                        src={getDisplayableBannerUrl(tokenSettings.tokenIconUrl, tokenSettings.tokenSymbol)} 
                        alt={tokenSettings.tokenName} 
                        width={64} 
                        height={64} 
                        className="rounded-full border-2 border-accent/50 p-1"
                    />
                    <div>
                        <p className="text-lg font-semibold text-foreground">{tokenSettings.tokenName} Wallet</p>
                        <p className="text-sm text-muted-foreground">{tokenSettings.tokenSymbol}</p>
                    </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                    <p className="text-sm text-muted-foreground">Current Balance</p>
                    <p className="text-4xl font-bold text-foreground">
                        {tokenWalletBalance.toLocaleString('en-US', { maximumFractionDigits: 8, useGrouping: false })}
                    </p>
                    <p className="text-md text-green-400 font-semibold">
                        ≈ <RupeeIcon className="inline h-4 -mt-1"/> {pkrValue.toFixed(2)}
                    </p>
                </div>
            </div>
            <div className="bg-black/20 px-6 py-2 border-t border-accent/20">
                <p className="text-xs text-center text-muted-foreground">
                    Current Price: 1 {tokenSettings.tokenSymbol} ≈ {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: true })} PKR
                </p>
            </div>
        </GlassCard>

        <GlassCard>
            <Tabs defaultValue={defaultTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={cn('grid w-full', {
                    'grid-cols-1': enabledTabs.length === 1,
                    'grid-cols-2': enabledTabs.length === 2,
                    'grid-cols-3': enabledTabs.length === 3,
                })}>
                    {enabledTabs.map(tab => (
                        <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
                    ))}
                </TabsList>

                {tokenSettings.buyEnabled && (
                    <TabsContent value="buy" className="pt-6 space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="pkr-buy">Amount to Spend (PKR)</Label>
                            <div className="relative">
                                <Input id="pkr-buy" type="text" inputMode="decimal" placeholder="0.00" className="bg-input/50" value={pkrAmount} onChange={(e) => handleAmountChange('pkr', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex items-center justify-center"><Repeat className="h-5 w-5 text-muted-foreground"/></div>
                        <div className="space-y-1">
                            <Label htmlFor="token-buy">Tokens to Receive ({tokenSettings.tokenSymbol})</Label>
                            <div className="relative"><Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="token-buy" type="text" inputMode="decimal" placeholder="0.0000" className="pl-8 bg-input/50" value={tokenAmount} onChange={(e) => handleAmountChange('token', e.target.value)} /></div>
                        </div>
                        <Button onClick={handleBuyTransaction} className="w-full neon-accent-bg" disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Buy {tokenSettings.tokenSymbol}
                        </Button>
                    </TabsContent>
                )}

                {tokenSettings.sellEnabled && (
                     <TabsContent value="sell" className="pt-6 space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                               <Label htmlFor="token-sell">Tokens to Sell ({tokenSettings.tokenSymbol})</Label>
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-accent"
                                    onClick={handleUseMax}
                                >
                                    Use Max
                                </Button>
                            </div>
                            <div className="relative"><Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="token-sell" type="text" inputMode="decimal" placeholder="0.0000" className="pl-8 bg-input/50" value={tokenAmount} onChange={(e) => handleAmountChange('token', e.target.value)} /></div>
                        </div>
                        <div className="flex items-center justify-center"><Repeat className="h-5 w-5 text-muted-foreground"/></div>
                        <div className="space-y-1">
                            <Label htmlFor="pkr-sell">Amount to Receive (PKR, approx.)</Label>
                            <div className="relative"><Input id="pkr-sell" type="text" inputMode="decimal" placeholder="0.00" className="bg-input/50" value={pkrAmount} readOnly /></div>
                        </div>
                        
                        {tokenAmount && parseFloat(tokenAmount) > 0 && tokenSettings.sellFeePercent && tokenSettings.sellFeePercent > 0 ? (
                            <Alert variant="default" className="mt-4 bg-muted/30 border-border/50 text-left p-4">
                                <AlertDescription asChild>
                                    <div className="text-xs space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Gross Payout</span>
                                            <span className="font-mono text-foreground">
                                                <RupeeIcon className="inline h-3.5" /> {grossValue.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: false })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Sell Fee ({tokenSettings.sellFeePercent || 0}%)</span>
                                            <span className="font-mono text-red-400">
                                                - <RupeeIcon className="inline h-3.5" /> {feeValue.toLocaleString('en-US', { maximumFractionDigits: 12, useGrouping: false })}
                                            </span>
                                        </div>
                                        <Separator className="my-2 bg-border/50"/>
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="font-semibold text-foreground text-sm">You will receive:</span>
                                            <span className="font-bold text-lg text-accent flex items-center gap-1">
                                                <RupeeIcon className="inline h-4 -mt-0.5"/> 
                                                {netPkrValue.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })}
                                            </span>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            tokenSettings.sellFeePercent && tokenSettings.sellFeePercent > 0 &&
                                <p className="text-xs text-muted-foreground text-center">A {tokenSettings.sellFeePercent}% fee will be deducted from your PKR payout.</p>
                        )}
    
                        <Button onClick={handleSellTransaction} className="w-full neon-accent-bg" disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Sell to Admin
                        </Button>
                    </TabsContent>
                )}

                {tokenSettings.marketplaceEnabled && (
                     <TabsContent value="marketplace" className="pt-6 space-y-4">
                       <P2PMarketplace appUser={localAppUser} tokenSettings={tokenSettings} />
                    </TabsContent>
                )}
            </Tabs>
        </GlassCard>

        <TokenTransactionList userId={localAppUser.id} tokenSymbol={tokenSettings.tokenSymbol} />
    </div>
  )
}
