
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, setHours, setMinutes, setSeconds, setMilliseconds, parseISO } from 'date-fns';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2, Loader2, Save } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Tournament } from '@/types';
import { database, auth } from '@/lib/firebase/config';
import { ref, push } from 'firebase/database';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const tournamentSchema = z.object({
  name: z.string().min(3, { message: "Tournament name must be at least 3 characters." }),
  game: z.string().min(2, { message: "Game name must be at least 2 characters." }),
  map: z.string().optional(),
  mode: z.enum(["Solo", "Duo", "Squad", "Custom"], { required_error: "Please select a game mode." }),
  entryFee: z.coerce.number().min(0, { message: "Entry fee cannot be negative." }),
  prizePool: z.coerce.number().min(0, { message: "Prize pool cannot be negative." }),
  perKillReward: z.coerce.number().min(0, { message: "Per kill reward cannot be negative." }).optional(),
  maxPlayers: z.coerce.number().min(2, { message: "Max players must be at least 2." }).max(1000, { message: "Max players cannot exceed 1000." }),
  startDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) {
      if (typeof arg === 'string' && arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = arg.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      try {
        const parsedDate = parseISO(String(arg)); 
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      } catch (e) { /* fall through */ }
      const d = new Date(arg);
      if (!isNaN(d.getTime())) return d;
    }
    return undefined; 
  }, z.date({ required_error: "Please select a start date." })),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }),
  customRules: z.string().optional(),
  bannerImageUrl: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.union([z.string().url({ message: "Please enter a valid URL." })]).optional()
  ),
  resultsProcessingTimeDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) {
      if (typeof arg === 'string' && arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = arg.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      const d = new Date(arg);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }, z.date().optional()),
  resultsProcessingTimeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }).optional(),
  autoPostResults: z.boolean().default(true).optional(),
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

export default function CreateTournamentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: "",
      game: "",
      map: "",
      mode: undefined,
      entryFee: 0,
      prizePool: 0,
      perKillReward: 0,
      maxPlayers: 50,
      startDate: undefined, 
      startTime: "18:00",
      customRules: "",
      bannerImageUrl: "",
      resultsProcessingTimeDate: undefined,
      resultsProcessingTimeTime: "23:00",
      autoPostResults: true,
    },
  });

  const onSubmit = async (data: TournamentFormValues) => {
    setIsSubmitting(true);
    const currentUser = auth.currentUser;

    if (!database || !currentUser) {
      toast({ title: "Error", description: "Database not initialized or user not logged in.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      const [hours, minutes] = data.startTime.split(':').map(Number);
      let combinedDateTime = setHours(data.startDate, hours);
      combinedDateTime = setMinutes(combinedDateTime, minutes);
      combinedDateTime = setSeconds(combinedDateTime, 0);
      combinedDateTime = setMilliseconds(combinedDateTime, 0);
      const isoStartTime = combinedDateTime.toISOString();

      if (new Date(isoStartTime) <= new Date()) {
          toast({ title: "Invalid Start Time", description: "Tournament start time must be in the future.", variant: "destructive" });
          setIsSubmitting(false);
          return;
      }
      
      let isoResultsProcessingTime: string | null = null;
      if (data.resultsProcessingTimeDate && data.resultsProcessingTimeTime) {
        const [resHours, resMinutes] = data.resultsProcessingTimeTime.split(':').map(Number);
        let combinedResTime = setHours(data.resultsProcessingTimeDate, resHours);
        combinedResTime = setMinutes(combinedResTime, resMinutes);
        combinedResTime = setSeconds(combinedResTime, 0);
        combinedResTime = setMilliseconds(combinedResTime, 0);
        isoResultsProcessingTime = combinedResTime.toISOString();
      }

      const newTournamentData: Omit<Tournament, 'id' | 'playersJoined' | 'joinedPlayersCount'> = {
        name: data.name,
        game: data.game,
        map: data.map || null,
        mode: data.mode,
        entryFee: data.entryFee,
        prizePool: data.prizePool,
        perKillReward: data.perKillReward || 0,
        maxPlayers: data.maxPlayers,
        status: 'upcoming', 
        startTime: isoStartTime,
        customRules: data.customRules || null,
        bannerImageUrl: data.bannerImageUrl || null,
        resultsPosted: false,
        createdBy: currentUser.uid,
        resultsProcessingTime: isoResultsProcessingTime,
        autoPostResults: data.autoPostResults,
      };

      await push(ref(database, 'tournaments'), newTournamentData);

      toast({
        title: "Tournament Created!",
        description: `"${data.name}" has been successfully created.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      router.push('/admin/tournaments'); 
    } catch (error) {
      console.error("Error creating tournament:", error);
      toast({ title: "Creation Failed", description: "Could not create tournament. " + (error instanceof Error ? error.message : "Please try again."), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gamepad2 className="h-8 w-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New Tournament</h1>
          <p className="text-muted-foreground">Fill in the details to set up a new tournament.</p>
        </div>
      </div>

      <GlassCard>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField name="name" label="Tournament Name" placeholder="e.g., Weekly PUBG Mobile Battle" form={form} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="game" label="Game Title" placeholder="e.g., PUBG Mobile, Free Fire" form={form} />
              <FormField name="map" label="Map (Optional)" placeholder="e.g., Erangel, Bermuda" form={form} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller name="mode" control={form.control} render={({ field }) => ( <FormItem field={field} label="Game Mode"><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-input/50 border-border/70 focus:border-accent"><SelectValue placeholder="Select game mode" /></SelectTrigger></FormControl><SelectContent className="glass-card"><SelectItem value="Solo">Solo</SelectItem><SelectItem value="Duo">Duo</SelectItem><SelectItem value="Squad">Squad</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FormItem> )} />
              <FormField name="maxPlayers" type="number" label="Max Players" placeholder="e.g., 100" form={form} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField name="entryFee" type="number" label="Entry Fee" placeholder="e.g., 50 or 0 for free" form={form} />
              <FormField name="prizePool" type="number" label="Total Prize Pool" placeholder="e.g., 1000" form={form} />
              <FormField name="perKillReward" type="number" label="Per Kill Reward (Optional)" placeholder="e.g., 5" form={form} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField name="startDate" type="date" label="Start Date (YYYY-MM-DD)" form={form} />
              <FormField name="startTime" type="time" label="Start Time (HH:MM)" form={form} />
            </div>
            
            <Separator className="my-4 bg-border/30" />
            <h3 className="text-lg font-semibold text-foreground -mb-2">Auto-Post Results Settings</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <FormField name="resultsProcessingTimeDate" type="date" label="Auto-Post Date" form={form} />
                <FormField name="resultsProcessingTimeTime" type="time" label="Auto-Post Time" form={form} />
            </div>
            <Controller name="autoPostResults" control={form.control} render={({ field }) => ( <FormItem field={field} label=""><div className="flex items-center space-x-2 pt-2"><Switch id="autoPostResultsToggle" checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-accent" /><Label htmlFor="autoPostResultsToggle" className="text-sm font-medium text-foreground cursor-pointer">Enable Auto-Posting of Results</Label></div></FormItem> )}/>

            <Separator className="my-4 bg-border/30" />
            <FormField name="bannerImageUrl" label="Banner Image URL (Optional)" placeholder="https://example.com/banner.jpg" form={form} />
            <Controller name="customRules" control={form.control} render={({ field }) => ( <FormItem field={field} label="Custom Rules (Optional)"><Textarea placeholder="Enter any custom rules for this tournament..." className="resize-y min-h-[100px] bg-input/50 border-border/70 focus:border-accent" {...field} value={field.value || ''} /></FormItem> )}/>

            <div className="flex justify-end pt-4"><Button type="submit" className="neon-accent-bg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}{isSubmitting ? 'Creating...' : 'Create Tournament'}</Button></div>
          </form>
        </FormProvider>
      </GlassCard>
    </div>
  );
}

const FormControl = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const FormMessage = ({ children }: { children?: React.ReactNode }) => <p className="text-xs text-destructive">{children}</p>;
const FormItem: React.FC<{field: any; label: string; children: React.ReactNode}> = ({ field, label, children }) => {
  const { formState: { errors } } = useFormContext(); 
  const error = errors[field.name]?.message as string | undefined;
  return ( <div className="space-y-1.5"><Label htmlFor={field.name} className={cn(error && "text-destructive")}>{label}</Label>{children}{error && <FormMessage>{error}</FormMessage>}</div> );
};
const FormField: React.FC<{name: keyof TournamentFormValues; label: string; placeholder?: string; type?: string; form: ReturnType<typeof useForm<TournamentFormValues>>}> = ({ name, label, placeholder, type = "text", form }) => {
  const { control } = form;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        let displayValue;
        if (type === 'date') {
          if (field.value instanceof Date) displayValue = format(field.value, 'yyyy-MM-dd');
          else if (typeof field.value === 'string' && field.value.match(/^\d{4}-\d{2}-\d{2}/)) displayValue = format(parseISO(field.value.substring(0, 10)), 'yyyy-MM-dd');
          else displayValue = '';
        } else if (type === 'number') {
          displayValue = (field.value === undefined || field.value === null || isNaN(Number(field.value))) ? '' : String(field.value);
        } else {
          displayValue = (field.value === undefined || field.value === null) ? '' : String(field.value);
        }
        return ( <FormItem field={field} label={label}><Input id={field.name} type={type} placeholder={placeholder} className="bg-input/50 border-border/70 focus:border-accent" {...field} value={displayValue} onChange={(e) => {
          if (type === 'number') { const val = e.target.value; field.onChange(val === '' ? undefined : parseFloat(val)); } 
          else if (type === 'date') { field.onChange(e.target.value === '' ? undefined : e.target.value); }
          else { field.onChange(e.target.value); }
        }} /></FormItem> );
      }}
    />
  );
};
