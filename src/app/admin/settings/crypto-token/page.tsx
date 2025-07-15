
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp, set, runTransaction } from 'firebase/database';
import type { GlobalSettings, TokenEconomyData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Form, FormField, FormItem } from '@/components/ui/form';
import { ArrowLeft, Loader2, Save, Coins, Info, AlertCircle, BarChart2, Users, Percent, Trash2, Zap, ShoppingCart, Repeat, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import RupeeIcon from '@/components/core/rupee-icon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const tokenSettingsSchema = z.object({
  enabled: z.boolean(),
  buyEnabled: z.boolean().optional(),
  sellEnabled: z.boolean().optional(),
  marketplaceEnabled: z.boolean().optional(),
  tokenName: z.string().min(3, "Token name must be at least 3 characters."),
  tokenSymbol: z.string().min(2, "Symbol must be 2-5 chars.").max(5),
  tokenIconUrl: z.string().url("Must be a valid URL.").or(z.literal('')),
  adminFeeWalletUid: z.string().min(10, "Admin UID seems too short."),
  totalSupply: z.coerce.number().min(1000, "Total supply must be at least 1000."),
  basePrice: z.coerce.number().min(0.00000000000001, "Base price must be positive.").optional(),
  sellFeePercent: z.coerce.number().min(0).max(100).optional(),
  transferFeePercent: z.coerce.number().min(0).max(100).optional(),
  marketFeePercent: z.coerce.number().min(0).max(100).optional(),
  autoPriceAdjustmentEnabled: z.boolean().optional(),
  priceAdjustmentThreshold: z.coerce.number().min(0).optional(),
  priceAdjustmentPercentage: z.coerce.number().min(0).max(100).optional(),
});

type TokenSettingsFormValues = z.infer<typeof tokenSettingsSchema>;

type LiveTokenData = {
    circulatingSupply: number;
}

const SwitchField = ({ control, name, label, description }: { control: any; name: string; label: string; description: string }) => (
    <Controller
        name={name}
        control={control}
        render={({ field }) => (
            <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30">
                <Label htmlFor={name} className="flex flex-col space-y-1">
                    <span className="text-md font-medium text-foreground cursor-pointer">{label}</span>
                    <span className="font-normal text-xs text-muted-foreground">{description}</span>
                </Label>
                <Switch
                    id={name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-accent"
                />
            </div>
        )}
    />
);


export default function AdminCryptoTokenSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [liveData, setLiveData] = useState<LiveTokenData | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<TokenSettingsFormValues>({
    resolver: zodResolver(tokenSettingsSchema),
    defaultValues: {
      enabled: false,
      buyEnabled: true,
      sellEnabled: true,
      marketplaceEnabled: true,
      tokenName: 'Arena Coin',
      tokenSymbol: 'ARC',
      tokenIconUrl: '',
      adminFeeWalletUid: '',
      totalSupply: 5000000000000,
      basePrice: 0.0000000001,
      sellFeePercent: 5,
      transferFeePercent: 3,
      marketFeePercent: 3.5,
      autoPriceAdjustmentEnabled: false,
      priceAdjustmentThreshold: 1000000000, // 1 Billion
      priceAdjustmentPercentage: 0.1,
    },
  });

  const { control, watch, setValue } = form;
  
  const tokenSettings = form.watch();
  const basePriceNum = Number(tokenSettings.basePrice);

  const tokensPerPkrString = useMemo(() => {
    if (basePriceNum && basePriceNum > 0) {
      return (1 / basePriceNum).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
    }
    return '';
  }, [basePriceNum]);

  const handleTokensPerPkrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || value === null) {
        setValue('basePrice', undefined, { shouldValidate: true, shouldDirty: true });
        return;
    }
    const tokens = parseFloat(value);
    if (!isNaN(tokens) && tokens > 0) {
      setValue('basePrice', 1 / tokens, { shouldValidate: true, shouldDirty: true });
    } else {
        setValue('basePrice', undefined, { shouldValidate: true, shouldDirty: true });
    }
  };
  
  const fetchSettings = useCallback(async () => {
    setIsFetching(true);
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      setIsFetching(false);
      return;
    }
    try {
      const settingsRef = ref(database, 'globalSettings/tokenSettings');
      const economyRef = ref(database, 'tokenEconomyData');
      
      const settingsSnapshot = await get(settingsRef);
      const economySnapshot = await get(economyRef);
      
      const economyData: TokenEconomyData = economySnapshot.exists() ? economySnapshot.val() : { circulatingSupply: 0 };
      const settingsData = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

      form.reset({ ...form.getValues(), ...settingsData });
      
      setLiveData({
        circulatingSupply: economyData.circulatingSupply || 0,
      });
      
    } catch (error: any) {
      console.error("Error fetching token settings:", error);
      let description = "Could not load token settings.";
      if (String(error.message).toUpperCase().includes("PERMISSION_DENIED")) {
        description = "Permission Denied. Check Firebase rules for reading /globalSettings and /tokenEconomyData.";
      }
      toast({ title: "Fetch Error", description, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [form, toast]);


  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (data: TokenSettingsFormValues) => {
    setIsSaving(true);
    try {
      if (!database) throw new Error("Database not available");
      
      const settingsToUpdate = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await update(ref(database, 'globalSettings/tokenSettings'), settingsToUpdate);

      toast({
        title: "Settings Saved",
        description: "Crypto token settings have been updated.",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSystem = async () => {
    setIsResetting(true);
    try {
      if (!database) throw new Error("Database not available for system reset.");
      
      const economyDataToSet: TokenEconomyData = {
          circulatingSupply: 0,
          volumeSinceLastAdjustment: 0,
      };

      const updates: Record<string, any> = {
        '/tokenEconomyData': economyDataToSet,
        '/tokenTransactions': null,
        '/tokenMarketplace': null,
        '/pending_payouts': null,
      };

      const usersSnap = await get(ref(database, 'users'));
      if (usersSnap.exists()) {
          const users = usersSnap.val();
          for (const uid in users) {
              updates[`/users/${uid}/tokenWallet`] = null;
          }
      }
      
      await update(ref(database), updates);

      toast({ title: "System Reset Successful", description: "The token economy has been reset to its initial state.", className: "bg-green-500/20" });
      await fetchSettings(); // Re-fetch to update UI
      setIsResetDialogOpen(false);
    } catch (error: any) {
        toast({ title: "Reset Failed", description: `Could not reset the system: ${error.message}`, variant: "destructive" });
    } finally {
        setIsResetting(false);
    }
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Coins className="mr-3 h-8 w-8 text-accent" /> Crypto Token Settings
            </h1>
            <Button variant="outline" asChild>
            <Link href="/admin/settings">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
            </Link>
            </Button>
        </div>
        
        {isFetching ? (
            <GlassCard><div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div></GlassCard>
        ) : (
            <GlassCard>
                <h3 className="text-xl font-semibold text-foreground mb-1">Live Market Data</h3>
                <p className="text-sm text-muted-foreground mb-4">Real-time overview of the token economy.</p>
                <Separator className="mb-6 bg-border/30" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><BarChart2 className="h-4 w-4"/>Fixed Price (PKR)</p>
                        <p className="text-2xl font-bold text-accent break-all">{!isNaN(basePriceNum) && basePriceNum > 0 ? basePriceNum.toLocaleString('en-US', { maximumFractionDigits: 20, useGrouping: false }) : '...'}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Users className="h-4 w-4"/>Circulating Supply</p>
                        <p className="text-2xl font-bold text-foreground break-all">{liveData?.circulatingSupply.toLocaleString() ?? '...'}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Market Cap (PKR)</p>
                        <p className="text-2xl font-bold text-foreground break-all">
                            <RupeeIcon className="inline h-5"/>
                            {liveData && !isNaN(basePriceNum) ? (basePriceNum * liveData.circulatingSupply).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '...'}
                        </p>
                    </div>
                </div>
            </GlassCard>
        )}

        <GlassCard>
            <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30 mb-6">
                <Label htmlFor="enabled" className="text-md font-medium text-foreground cursor-pointer">Enable Token System</Label>
                <Controller name="enabled" control={form.control} render={({ field }) => (
                    <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-accent" />
                )}/>
            </div>
            
             <h3 className="text-xl font-semibold text-foreground mb-1">Token Configuration</h3>
            <p className="text-sm text-muted-foreground mb-4">Define the core properties of your in-app token.</p>
            <Separator className="mb-6 bg-border/30" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="tokenName" render={({ field }) => (<FormItem><Label>Token Name</Label><Input {...field} placeholder="e.g., Arena Coin" className="mt-1 bg-input/50" /></FormItem>)} />
                <FormField control={form.control} name="tokenSymbol" render={({ field }) => (<FormItem><Label>Token Symbol</Label><Input {...field} placeholder="e.g., ARC" className="mt-1 bg-input/50" /></FormItem>)} />
                <FormField control={form.control} name="tokenIconUrl" render={({ field }) => (<FormItem><Label>Token Icon URL</Label><Input {...field} placeholder="https://..." className="mt-1 bg-input/50" /></FormItem>)} />
            </div>
            <div className="mt-6">
              <FormField control={form.control} name="adminFeeWalletUid" render={({ field }) => (<FormItem><Label>Admin Payout & Fee Wallet UID</Label><Input {...field} placeholder="Firebase UID of the admin user to receive fees & payouts" className="mt-1 bg-input/50" /></FormItem>)} />
            </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-xl font-semibold text-foreground mb-1">Feature Visibility</h3>
          <p className="text-sm text-muted-foreground mb-4">Individually enable or disable different token features.</p>
          <Separator className="mb-6 bg-border/30" />
          <div className="space-y-4">
            <SwitchField control={form.control} name="buyEnabled" label="Enable Token Buying" description="Allows users to buy tokens from the admin." />
            <SwitchField control={form.control} name="sellEnabled" label="Enable Token Selling" description="Allows users to sell tokens back to the admin." />
            <SwitchField control={form.control} name="marketplaceEnabled" label="Enable P2P Marketplace" description="Allows users to trade tokens with each other." />
          </div>
        </GlassCard>
        
        <GlassCard>
            <h3 className="text-xl font-semibold text-foreground mb-1">Transaction Fees</h3>
            <p className="text-sm text-muted-foreground mb-4">Set percentage-based fees for different token transactions.</p>
            <Separator className="mb-6 bg-border/30" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="sellFeePercent" render={({ field }) => (<FormItem><Label className="flex items-center gap-1"><Percent className="h-3 w-3"/>Sell to Admin Fee</Label><Input type="number" {...field} placeholder="e.g., 5" step="0.1" className="mt-1 bg-input/50" /></FormItem>)} />
                <FormField control={form.control} name="transferFeePercent" render={({ field }) => (<FormItem><Label className="flex items-center gap-1"><Percent className="h-3 w-3"/>P2P Transfer Fee</Label><Input type="number" {...field} placeholder="e.g., 3" step="0.1" className="mt-1 bg-input/50" /></FormItem>)} />
                <FormField control={form.control} name="marketFeePercent" render={({ field }) => (<FormItem><Label className="flex items-center gap-1"><Percent className="h-3 w-3"/>Marketplace Sale Fee</Label><Input type="number" {...field} placeholder="e.g., 3.5" step="0.1" className="mt-1 bg-input/50" /></FormItem>)} />
            </div>
        </GlassCard>

        <GlassCard>
             <h3 className="text-xl font-semibold text-foreground mb-1">Economic Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">Control the total supply and token price. Changing one price field will automatically update the other.</p>
            <Separator className="mb-6 bg-border/30" />
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={control} name="totalSupply" render={({ field }) => (<FormItem><Label>Total Supply</Label><Input type="number" {...field} placeholder="e.g., 2000000000000" className="mt-1 bg-input/50" /></FormItem>)} />
                 <FormField control={control} name="basePrice" render={({ field }) => (
                    <FormItem>
                        <Label>Base Price (PKR per Token)</Label>
                        <Input 
                            type="text" 
                            inputMode="decimal"
                            value={
                                field.value === undefined || field.value === null
                                    ? ''
                                    : Number(field.value).toLocaleString('en-US', {
                                          useGrouping: false,
                                          maximumFractionDigits: 20,
                                      })
                            }
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || value === null) {
                                    field.onChange(undefined);
                                } else {
                                    const numericValue = parseFloat(value);
                                    if (!isNaN(numericValue)) {
                                      field.onChange(numericValue);
                                    }
                                }
                            }}
                            placeholder="e.g., 0.0000000001" 
                            className="mt-1 bg-input/50" 
                        />
                    </FormItem>
                )} />
                <FormItem>
                    <Label>Tokens per 1 PKR</Label>
                    <Input 
                        type="text" 
                        inputMode="decimal"
                        value={tokensPerPkrString}
                        onChange={handleTokensPerPkrChange}
                        placeholder="e.g., 10000000000" 
                        className="mt-1 bg-input/50" 
                    />
                </FormItem>
            </div>
        </GlassCard>

        <GlassCard>
            <div className="flex items-center justify-between space-x-2 bg-background/30 p-4 rounded-md border border-border/30 mb-6">
                <Label htmlFor="autoPriceAdjustmentEnabled" className="text-md font-medium text-foreground cursor-pointer flex items-center gap-2"><Zap className="h-5 w-5 text-accent"/>Automated Price Adjustment</Label>
                <Controller name="autoPriceAdjustmentEnabled" control={form.control} render={({ field }) => (
                    <Switch id="autoPriceAdjustmentEnabled" checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-accent" />
                )}/>
            </div>
            {tokenSettings.autoPriceAdjustmentEnabled && (
                 <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Adjust the token price automatically based on trade volume.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="priceAdjustmentThreshold" render={({ field }) => (<FormItem><Label>Trade Volume Threshold</Label><Input type="number" {...field} placeholder="e.g., 1000000000" className="mt-1 bg-input/50" /><p className="text-xs text-muted-foreground mt-1">Adjust price after this many tokens are traded.</p></FormItem>)} />
                        <FormField control={form.control} name="priceAdjustmentPercentage" render={({ field }) => (<FormItem><Label>Price Adjustment (%)</Label><Input type="number" {...field} placeholder="e.g., 0.1" step="0.01" className="mt-1 bg-input/50" /><p className="text-xs text-muted-foreground mt-1">Increase/decrease price by this percentage.</p></FormItem>)} />
                    </div>
                </div>
            )}
        </GlassCard>

        <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="neon-accent-bg" disabled={isSaving}>
            <Save className="mr-2 h-5 w-5" /> {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
        </form>

        <Separator className="my-8"/>

        <GlassCard className="border-destructive/50">
            <h3 className="text-xl font-semibold text-destructive mb-1">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">These actions are irreversible. Please proceed with caution.</p>
            <Separator className="mb-6 bg-destructive/30" />
            <div className="flex justify-between items-center">
                <div>
                <p className="font-medium text-foreground">Reset Token System</p>
                <p className="text-xs text-muted-foreground">This will wipe all token wallets, transactions, and market data, resetting the system to its initial state using the economic settings above.</p>
                </div>
                <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/>Reset System</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. It will permanently delete all user token balances, transaction histories, market orders, and pending payouts. The system will be reset using the configured economic settings.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetSystem} disabled={isResetting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, reset the entire token system
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                </AlertDialog>
            </div>
        </GlassCard>
    </Form>
  );
}
