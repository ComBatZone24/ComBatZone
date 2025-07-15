
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from 'next/link';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { GlobalSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Save, Rocket, Disc, Gamepad2, FileImage, PlusCircle, Trash2, Palette, Weight, Info, Zap, Swords, AlertCircle, Percent } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from '@/components/ui/slider';
import RupeeIcon from '@/components/core/rupee-icon';

const segmentSchema = z.object({
  label: z.string().min(1, "Label is required."),
  multiplier: z.coerce.number(),
  color: z.string().regex(/^hsl\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\)$/, "Must be a valid HSL color (e.g., hsl(220, 80%, 60%))"),
});

const chipSchema = z.object({
  value: z.coerce.number().min(1, "Chip value must be at least 1."),
  winRate: z.coerce.number().min(0, "Win rate must be between 0 and 100.").max(100),
});

const gamesSettingsSchema = z.object({
  duelsCardSettings: z.object({
    enabled: z.boolean(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    imageUrl: z.string().url("Must be a valid URL").or(z.literal('')),
    buttonText: z.string().min(1, "Button text is required"),
  }),
  spinWheelSettings: z.object({
    enabled: z.boolean(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    imageUrl: z.string().url("Must be a valid URL").or(z.literal('')),
    buttonText: z.string().min(1, "Button text is required"),
    winRate: z.coerce.number().min(0).max(100).optional(),
    largeBetThreshold: z.coerce.number().min(0).optional(),
    largeBetWinRate: z.coerce.number().min(0).max(100).optional(),
    segments: z.array(segmentSchema).min(2, "Must have at least 2 segments.").max(12, "Cannot have more than 12 segments."),
  }),
  dragonTigerSettings: z.object({
    enabled: z.boolean(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    imageUrl: z.string().url("Must be a valid URL").or(z.literal('')).describe("Background image for the game board."),
    dragonImageUrl: z.string().url("Must be a valid URL").or(z.literal('')).optional().describe("Image for the Dragon betting area."),
    tigerImageUrl: z.string().url("Must be a valid URL").or(z.literal('')).optional().describe("Image for the Tiger betting area."),
    tieImageUrl: z.string().url("Must be a valid URL").or(z.literal('')).optional().describe("Image for the Tie betting area."),
    buttonText: z.string().min(1, "Button text is required"),
    chips: z.array(chipSchema).min(1, "You must define at least one chip tier."),
    dragonTotalReturnMultiplier: z.coerce.number().min(0.1, "Multiplier must be at least 0.1.").max(9.9, "Multiplier cannot exceed 9.9.").optional(),
    tigerTotalReturnMultiplier: z.coerce.number().min(0.1, "Multiplier must be at least 0.1.").max(9.9, "Multiplier cannot exceed 9.9.").optional(),
    tieTotalReturnMultiplier: z.coerce.number().min(0.1, "Multiplier must be at least 0.1.").max(19.9, "Multiplier cannot exceed 19.9.").optional(),
    tieFrequency: z.coerce.number().min(0).max(100).optional(),
    roundTimer: z.coerce.number().min(3).max(60).optional(),
  }),
});

type GamesSettingsFormValues = z.infer<typeof gamesSettingsSchema>;

const defaultSettings: GamesSettingsFormValues = {
  duelsCardSettings: {
    enabled: true,
    title: 'Cybernetic Duels',
    description: 'Challenge a cunning AI in a fast-paced game of Rock, Paper, Scissors. Bet high, win bigger!',
    imageUrl: 'https://placehold.co/400x300.png',
    buttonText: 'Enter the Duel Arena',
  },
  spinWheelSettings: {
    enabled: true,
    title: 'Spin the Wheel',
    description: 'Feeling lucky? Spin the wheel for a chance to multiply your wager instantly!',
    imageUrl: 'https://placehold.co/400x300.png',
    buttonText: 'Try Your Luck',
    winRate: 40,
    largeBetThreshold: 5000,
    largeBetWinRate: 0.01,
    segments: [
      { label: "2x", multiplier: 2, color: "hsl(220, 80%, 60%)" },
      { label: "0x", multiplier: 0, color: "hsl(0, 80%, 60%)" },
      { label: "1.5x", multiplier: 1.5, color: "hsl(140, 80%, 60%)" },
      { label: "0.5x", multiplier: 0.5, color: "hsl(60, 80%, 60%)" },
      { label: "5x", multiplier: 5, color: "hsl(280, 80%, 60%)" },
      { label: "0x", multiplier: 0, color: "hsl(0, 80%, 60%)" },
      { label: "1x", multiplier: 1, color: "hsl(180, 80%, 60%)" },
      { label: "0.5x", multiplier: 0.5, color: "hsl(60, 80%, 60%)" },
    ],
  },
  dragonTigerSettings: {
    enabled: true,
    title: 'Dragon vs Tiger',
    description: 'A simple, fast-paced game of high card. Bet on Dragon, Tiger, or a Tie.',
    imageUrl: 'https://placehold.co/400x300.png',
    dragonImageUrl: '',
    tigerImageUrl: '',
    tieImageUrl: '',
    buttonText: 'Play Now',
    chips: [
        { value: 20, winRate: 48.5 },
        { value: 100, winRate: 45 },
        { value: 500, winRate: 40 },
        { value: 1000, winRate: 25 },
        { value: 5000, winRate: 5 },
    ],
    dragonTotalReturnMultiplier: 1.95,
    tigerTotalReturnMultiplier: 1.95,
    tieTotalReturnMultiplier: 9,
    tieFrequency: 10,
    roundTimer: 8,
  },
};


export default function AdminGamesSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<GamesSettingsFormValues>({
    resolver: zodResolver(gamesSettingsSchema),
    defaultValues: defaultSettings,
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "spinWheelSettings.segments"
  });

  const { fields: dtChipsFields, append: dtChipsAppend, remove: dtChipsRemove } = useFieldArray({
    control: form.control,
    name: "dragonTigerSettings.chips"
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!database) {
        toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const settingsRef = ref(database, 'globalSettings');
        const snapshot = await get(settingsRef);
        
        if (snapshot.exists()) {
            const fetchedSettings = snapshot.val() || {};

            const newFormState = {
              duelsCardSettings: {
                ...defaultSettings.duelsCardSettings,
                ...(fetchedSettings.duelsCardSettings || {}),
              },
              spinWheelSettings: {
                ...defaultSettings.spinWheelSettings,
                ...(fetchedSettings.spinWheelSettings || {}),
                segments: (fetchedSettings.spinWheelSettings?.segments && fetchedSettings.spinWheelSettings.segments.length > 0)
                  ? fetchedSettings.spinWheelSettings.segments
                  : defaultSettings.spinWheelSettings.segments,
              },
              dragonTigerSettings: {
                ...defaultSettings.dragonTigerSettings,
                ...(fetchedSettings.dragonTigerSettings || {}),
                chips: (fetchedSettings.dragonTigerSettings?.chips && fetchedSettings.dragonTigerSettings.chips.length > 0)
                  ? fetchedSettings.dragonTigerSettings.chips
                  : defaultSettings.dragonTigerSettings.chips,
              },
            };
            form.reset(newFormState);
        } else {
             form.reset(defaultSettings);
        }
      } catch (error) {
        console.error("Error fetching games settings:", error);
        toast({ title: "Fetch Error", description: "Could not load games settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [toast, form]);

  const handleSave = async (data: GamesSettingsFormValues) => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Cannot save settings.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = JSON.parse(JSON.stringify(data));
      if (dataToSave.spinWheelSettings.segments) {
        dataToSave.spinWheelSettings.segments = dataToSave.spinWheelSettings.segments.map(
            ({ label, multiplier, color }: { label: string, multiplier: number, color: string}) => ({
                label, multiplier, color
            })
        );
      }
      
      const updates: Record<string, any> = {
        'globalSettings/duelsCardSettings': dataToSave.duelsCardSettings,
        'globalSettings/spinWheelSettings': dataToSave.spinWheelSettings,
        'globalSettings/dragonTigerSettings': dataToSave.dragonTigerSettings,
        'globalSettings/updatedAt': serverTimestamp(),
      };
      
      await update(ref(database), updates);

      toast({
        title: "Settings Saved",
        description: "Games settings have been updated successfully.",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save settings: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading Games Settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Gamepad2 className="mr-3 h-8 w-8 text-accent" /> Manage Games
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <GlassCard>
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground flex items-center"><Swords className="mr-2 h-5 w-5 text-accent"/> Dragon vs Tiger</h3>
                <Controller control={form.control} name="dragonTigerSettings.enabled" render={({field}) => (
                    <div className="flex items-center gap-2"><Label htmlFor="dvt-enabled" className="text-sm">Enable</Label><Switch id="dvt-enabled" checked={field.value} onCheckedChange={field.onChange} /></div>
                )}/>
            </div>
            <Separator />
            
            <h4 className="font-semibold text-lg text-foreground pt-4 border-t border-border/30">Appearance Settings</h4>
            <div className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="dvt-title" className="text-muted-foreground">Card Title</Label>
                    <Input id="dvt-title" {...form.register('dragonTigerSettings.title')} className="bg-input/50" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dvt-description" className="text-muted-foreground">Card Description</Label>
                    <Textarea id="dvt-description" {...form.register('dragonTigerSettings.description')} className="bg-input/50"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dvt-imageUrl" className="flex items-center text-muted-foreground"><FileImage className="mr-2 h-4 w-4" /> Game Background Image URL</Label>
                    <Input id="dvt-imageUrl" {...form.register('dragonTigerSettings.imageUrl')} className="bg-input/50" />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="dvt-dragonImageUrl" className="text-muted-foreground">Dragon Area Image URL</Label>
                        <Input id="dvt-dragonImageUrl" {...form.register('dragonTigerSettings.dragonImageUrl')} className="bg-input/50" placeholder="Optional image for Dragon area" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dvt-tigerImageUrl" className="text-muted-foreground">Tiger Area Image URL</Label>
                        <Input id="dvt-tigerImageUrl" {...form.register('dragonTigerSettings.tigerImageUrl')} className="bg-input/50" placeholder="Optional image for Tiger area" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dvt-tieImageUrl" className="text-muted-foreground">Tie Area Image URL</Label>
                        <Input id="dvt-tieImageUrl" {...form.register('dragonTigerSettings.tieImageUrl')} className="bg-input/50" placeholder="Optional image for Tie area"/>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dvt-buttonText" className="text-muted-foreground">Button Text</Label>
                    <Input id="dvt-buttonText" {...form.register('dragonTigerSettings.buttonText')} className="bg-input/50" />
                </div>
            </div>

            <h4 className="font-semibold text-lg text-foreground pt-4 border-t border-border/30">Game Economics & Timing</h4>
            <div className="p-4 rounded-lg bg-background/40 border border-border/50">
                <h5 className="font-semibold text-md text-foreground">Bet Tiers & Win Rates</h5>
                <p className="text-xs text-muted-foreground mb-2">Controls the CHANCE of winning based on bet size. A player's total bet is matched against the highest applicable tier. This is independent of payout amounts.</p>
                <div className="space-y-3 mt-4">
                    {dtChipsFields.map((field, index) => (
                    <GlassCard key={field.id} className="p-4 bg-background/40">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-medium text-foreground">Bet Tier {index + 1}</p>
                                <p className="text-xs text-muted-foreground">Settings for bets of a certain amount or higher.</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="text-destructive -mt-2 -mr-2" onClick={() => dtChipsRemove(index)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                        <Separator className="my-3 bg-border/50" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor={`tier-value-${index}`}>Bet Amount Threshold (&gt;= Rs)</Label>
                                <Input id={`tier-value-${index}`} type="number" {...form.register(`dragonTigerSettings.chips.${index}.value`)} placeholder="e.g., 1000" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`tier-winrate-${index}`}>Win Rate (%)</Label>
                                <Input id={`tier-winrate-${index}`} type="number" {...form.register(`dragonTigerSettings.chips.${index}.winRate`)} placeholder="e.g., 25" step="0.1" />
                            </div>
                        </div>
                    </GlassCard>
                    ))}
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => dtChipsAppend({ value: 10000, winRate: 5 })}><PlusCircle className="mr-2 h-4 w-4"/>Add Bet Tier</Button>
                </div>
            </div>

            <div className="p-4 rounded-lg bg-background/40 border border-border/50">
                <h5 className="font-semibold text-md text-foreground">Payouts & Odds</h5>
                <p className="text-xs text-muted-foreground mb-2">Controls the REWARD on a win and general game odds. Independent of win rates.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="dvt-dragonPayout" className="text-md flex items-center gap-1">Dragon Total Return Multiplier</Label>
                        <Input id="dvt-dragonPayout" type="number" {...form.register('dragonTigerSettings.dragonTotalReturnMultiplier')} className="bg-input/50" placeholder="e.g., 1.95" step="0.01" min="0.1" max="9.9"/>
                        <p className="text-xs text-muted-foreground">Total amount returned. E.g., `1.95` returns 195 on a 100 bet.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dvt-tigerPayout" className="text-md flex items-center gap-1">Tiger Total Return Multiplier</Label>
                        <Input id="dvt-tigerPayout" type="number" {...form.register('dragonTigerSettings.tigerTotalReturnMultiplier')} className="bg-input/50" placeholder="e.g., 1.95" step="0.01" min="0.1" max="9.9"/>
                        <p className="text-xs text-muted-foreground">Total amount returned. E.g., `1.95` returns 195 on a 100 bet.</p>
                    </div>
                        <div className="space-y-2">
                        <Label htmlFor="dvt-tiePayout" className="text-md flex items-center gap-1">Tie Total Return Multiplier</Label>
                        <Input id="dvt-tiePayout" type="number" {...form.register('dragonTigerSettings.tieTotalReturnMultiplier')} className="bg-input/50" placeholder="e.g., 9" step="0.01" min="0.1" max="19.9"/>
                        <p className="text-xs text-muted-foreground">Total amount returned. E.g., `9` returns 900 on a 100 bet.</p>
                    </div>
                </div>
                <Controller
                    control={form.control} name="dragonTigerSettings.tieFrequency" render={({ field }) => (
                        <div className="space-y-3 pt-4">
                            <Label htmlFor="dvt-tieFreq" className="text-md flex items-center gap-1"><Percent className="h-3"/>Tie Frequency ({field.value || 0}%)</Label>
                            <p className="text-xs text-muted-foreground -mt-2">The probability of any given round resulting in a Tie.</p>
                            <Slider id="dvt-tieFreq" min={0} max={100} step={0.5} value={[field.value || 0]} onValueChange={(vals) => field.onChange(vals[0])}/>
                        </div>
                    )}
                />

                <div className="space-y-2 pt-4">
                    <Label htmlFor="dvt-roundTimer" className="text-md">Round Timer (seconds)</Label>
                    <Input id="dvt-roundTimer" type="number" {...form.register('dragonTigerSettings.roundTimer')} className="bg-input/50 w-full md:w-1/2" placeholder="e.g., 15"/>
                    <p className="text-xs text-muted-foreground">Time between rounds for placing bets. Min: 3s.</p>
                </div>
            </div>
        </div>
      </GlassCard>
      
      <GlassCard>
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground flex items-center"><Rocket className="mr-2 h-5 w-5 text-accent"/> Cybernetic Duels Card</h3>
                <Controller control={form.control} name="duelsCardSettings.enabled" render={({field}) => (
                    <div className="flex items-center gap-2"><Label htmlFor="duels-enabled" className="text-sm">Enable</Label><Switch id="duels-enabled" checked={field.value} onCheckedChange={field.onChange} /></div>
                )}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="duels-title" className="text-muted-foreground">Card Title</Label>
                <Input id="duels-title" {...form.register('duelsCardSettings.title')} className="bg-input/50" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="duels-description" className="text-muted-foreground">Card Description</Label>
                <Textarea id="duels-description" {...form.register('duelsCardSettings.description')} className="bg-input/50"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="duels-imageUrl" className="flex items-center text-muted-foreground"><FileImage className="mr-2 h-4 w-4" /> Banner Image URL</Label>
                <Input id="duels-imageUrl" {...form.register('duelsCardSettings.imageUrl')} className="bg-input/50" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="duels-buttonText" className="text-muted-foreground">Button Text</Label>
                <Input id="duels-buttonText" {...form.register('duelsCardSettings.buttonText')} className="bg-input/50" />
            </div>
        </div>
      </GlassCard>

      <Separator />

      <GlassCard>
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground flex items-center"><Disc className="mr-2 h-5 w-5 text-accent"/> Spin the Wheel Settings</h3>
                <Controller control={form.control} name="spinWheelSettings.enabled" render={({field}) => (
                    <div className="flex items-center gap-2"><Label htmlFor="spin-enabled" className="text-sm">Enable</Label><Switch id="spin-enabled" checked={field.value} onCheckedChange={field.onChange} /></div>
                )}/>
            </div>
        </div>
        <div className="space-y-6 p-6 pt-0">
             <div className="space-y-2">
                <Label htmlFor="spin-title" className="text-muted-foreground">Card Title</Label>
                <Input id="spin-title" {...form.register('spinWheelSettings.title')} className="bg-input/50" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="spin-description" className="text-muted-foreground">Card Description</Label>
                <Textarea id="spin-description" {...form.register('spinWheelSettings.description')} className="bg-input/50"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="spin-imageUrl" className="flex items-center text-muted-foreground"><FileImage className="mr-2 h-4 w-4" /> Banner Image URL</Label>
                <Input id="spin-imageUrl" {...form.register('spinWheelSettings.imageUrl')} className="bg-input/50" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="spin-buttonText" className="text-muted-foreground">Button Text</Label>
                <Input id="spin-buttonText" {...form.register('spinWheelSettings.buttonText')} className="bg-input/50" />
            </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
            <h3 className="text-xl font-semibold text-foreground flex items-center"><Zap className="mr-2 h-5 w-5 text-accent"/> Economic &amp; Risk Configuration</h3>
            <p className="text-sm text-muted-foreground mt-1">
                Dynamically adjust win rates for normal vs. high-stakes bets.
            </p>
        </div>
        <div className="space-y-6 p-6 pt-0">
             <Controller
                control={form.control}
                name="spinWheelSettings.winRate"
                render={({ field }) => (
                    <div className="space-y-3 p-3 border rounded-md bg-background/30">
                        <Label htmlFor="winRate" className="text-md">Default Win Rate ({field.value || 0}%)</Label>
                        <p className="text-xs text-muted-foreground">
                            The standard probability of landing on a winning segment (multiplier > 1).
                        </p>
                        <Slider
                            id="winRate"
                            min={0}
                            max={100}
                            step={1}
                            value={[field.value || 0]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                        />
                    </div>
                )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Controller
                control={form.control}
                name="spinWheelSettings.largeBetThreshold"
                render={({ field }) => (
                    <div className="space-y-2">
                    <Label htmlFor="largeBetThreshold" className="text-md">Large Bet Threshold (PKR)</Label>
                    <p className="text-xs text-muted-foreground">Bets equal to or greater than this amount will use the special win rate below.</p>
                    <Input 
                        id="largeBetThreshold"
                        type="number"
                        min={0}
                        placeholder="e.g., 5000"
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                        className="bg-input/50"
                    />
                    </div>
                )}
                />
                <Controller
                    control={form.control}
                    name="spinWheelSettings.largeBetWinRate"
                    render={({ field }) => (
                        <div className="space-y-3">
                            <Label htmlFor="largeBetWinRate" className="text-md">Large Bet Win Rate ({field.value || 0}%)</Label>
                            <p className="text-xs text-muted-foreground">The win probability for large bets. Set low to increase profit margin.</p>
                            <Slider
                                id="largeBetWinRate"
                                min={0}
                                max={100}
                                step={0.01}
                                value={[field.value || 0]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                            />
                        </div>
                    )}
                />
            </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
            <h4 className="text-lg font-semibold text-foreground">Wheel Segments Configuration</h4>
             <Alert variant="default" className="mt-4 bg-primary/10 border-primary/30 text-primary-foreground/80">
                <Info className="h-4 w-4 !text-primary" />
                <AlertTitle className="text-primary">Automatic Weights</AlertTitle>
                <AlertDescription>
                    The "Weight" of each segment is calculated automatically by the backend based on the Win Rate sliders above. You only need to configure the label, multiplier, and color.
                </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,auto] gap-3 px-1 mt-4 items-center">
                <Label className="text-xs text-muted-foreground">Segment Label</Label>
                <Label className="text-xs text-muted-foreground">Multiplier</Label>
                <Label className="text-xs text-muted-foreground">HSL Color</Label>
                <div />
            </div>
            <div className="space-y-4 mt-2">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,auto] gap-3 p-3 border rounded-md bg-background/30 items-center">
                        <Input {...form.register(`spinWheelSettings.segments.${index}.label`)} placeholder="Label (e.g., 2x)" />
                        <Input {...form.register(`spinWheelSettings.segments.${index}.multiplier`)} type="number" step="0.1" placeholder="Multiplier (e.g., 2)" />
                        <div className="flex items-center gap-2">
                            <Input {...form.register(`spinWheelSettings.segments.${index}.color`)} placeholder="hsl(0, 80%, 60%)" />
                            <div className="h-6 w-6 rounded-md border" style={{ backgroundColor: form.watch(`spinWheelSettings.segments.${index}.color`) || 'transparent' }}></div>
                        </div>
                         <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
            </div>
             <Button type="button" variant="outline" onClick={() => append({ label: "1x", multiplier: 1, color: "hsl(200, 80%, 60%)" })} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Segment</Button>
        </div>
      </GlassCard>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSaving} className="neon-accent-bg">
          {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
          Save All Game Settings
        </Button>
      </div>
    </form>
  );
}
