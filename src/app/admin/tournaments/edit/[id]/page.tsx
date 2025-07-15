"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO, setHours, setMinutes, setSeconds, setMilliseconds, isFuture, isValid } from 'date-fns';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2, Loader2, Save, ArrowLeft, KeyRound, Clock, CalendarDays as CalendarIcon, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Tournament } from '@/types';
import { database } from '@/lib/firebase/config';
import { ref, get, update } from 'firebase/database';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import CountdownTimer from '@/components/core/countdown-timer';
import { Switch } from '@/components/ui/switch';

const tournamentSchema = z.object({
  name: z.string().min(3, { message: "Tournament name must be at least 3 characters." }),
  game: z.string().min(2, { message: "Game name must be at least 2 characters." }),
  map: z.string().optional().or(z.literal('')),
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
      try { const parsedDate = parseISO(String(arg)); if (!isNaN(parsedDate.getTime())) return parsedDate; } catch (e) { /* fall through */ }
      const d = new Date(arg); if (!isNaN(d.getTime())) return d;
    }
    return undefined;
  }, z.date({ required_error: "Please select a start date." })),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }),
  status: z.enum(["upcoming", "live", "completed", "archived"], { required_error: "Please select a status." }),
  customRules: z.string().optional(),
  bannerImageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  roomId: z.string().optional().or(z.literal('')),
  roomPassword: z.string().optional().or(z.literal('')),
  resultsProcessingTimeDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) {
      if (typeof arg === 'string' && arg.match(/^\d{4}-\d{2}-\d{2}$/)) { const [year, month, day] = arg.split('-').map(Number); return new Date(year, month - 1, day); }
      const d = new Date(arg); return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }, z.date().optional()),
  resultsProcessingTimeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }).optional(),
  autoPostResults: z.boolean().default(true).optional(),
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

const FormControl = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const FormMessage = ({ children }: { children?: React.ReactNode }) => <p className="text-xs text-destructive">{children}</p>;
const FormItem: React.FC<{field: any; label: string; children: React.ReactNode}> = ({ field, label, children }) => {
  const { formState: { errors } } = useFormContext();
  const error = errors[field.name]?.message as string | undefined;
  return ( <div className="space-y-1.5"><Label htmlFor={field.name} className={cn(error && "text-destructive")}>{label}</Label>{children}{error && <FormMessage>{error}</FormMessage>}</div> );
};
const CustomFormField: React.FC<{name: keyof TournamentFormValues; label: string; placeholder?: string; type?: string;}> = ({ name, label, placeholder, type = "text" }) => {
  const { control } = useFormContext<TournamentFormValues>();
  return (
    <Controller name={name} control={control} render={({ field }) => {
        let displayValue;
        if (type === 'date') {
          if (field.value instanceof Date && isValid(field.value)) try { displayValue = format(field.value, 'yyyy-MM-dd'); } catch (e) { displayValue = ''; }
          else if (typeof field.value === 'string' && field.value.match(/^\d{4}-\d{2}-\d{2}/)) try { const parsed = parseISO(field.value.substring(0, 10)); displayValue = isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : ''; } catch (e) { displayValue = ''; }
          else displayValue = '';
        } else if (type === 'number') { displayValue = (field.value === undefined || field.value === null || isNaN(Number(field.value))) ? '' : String(field.value);
        } else { displayValue = (field.value === undefined || field.value === null) ? '' : String(field.value); }
        return ( <FormItem field={field} label={label}><Input id={field.name} type={type} placeholder={placeholder} className="bg-input/50" {...field} value={displayValue} onChange={(e) => {
            if (type === 'number') { const val = e.target.value; field.onChange(val === '' ? undefined : parseFloat(val)); } 
            else if (type === 'date') { field.onChange(e.target.value === '' ? undefined : e.target.value); }
            else { field.onChange(e.target.value); }
        }} /></FormItem> );
    }}/>
  );
};


export default function EditTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const tournamentId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentTournamentData, setCurrentTournamentData] = useState<Tournament | null>(null);

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: "", game: "", map: "", mode: undefined, entryFee: 0, prizePool: 0, perKillReward: 0, maxPlayers: 50,
      startDate: undefined, startTime: "18:00", status: "upcoming", customRules: "", bannerImageUrl: "",
      roomId: "", roomPassword: "", resultsProcessingTimeDate: undefined, resultsProcessingTimeTime: "23:00", autoPostResults: true,
    },
  });

  const fetchAndSetTournamentData = useCallback(async () => {
    if (!tournamentId || !database) {
      setFetchError("Invalid tournament ID or database not available.");
      setIsLoading(false);
      if (!database) toast({ title: "Firebase Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const tournamentRef = ref(database, `tournaments/${tournamentId}`);
      const snapshot = await get(tournamentRef);
      if (snapshot.exists()) {
        const fetchedTournament = snapshot.val() as Tournament;
        setCurrentTournamentData(fetchedTournament);
        const tournamentDate = parseISO(fetchedTournament.startTime);
        
        let resultsProcessingDateTime: Date | undefined = undefined;
        let resultsProcessingTimeStr: string | undefined = form.formState.defaultValues?.resultsProcessingTimeTime;

        if (fetchedTournament.resultsProcessingTime) {
            try {
                resultsProcessingDateTime = parseISO(fetchedTournament.resultsProcessingTime);
                if (isValid(resultsProcessingDateTime)) {
                    resultsProcessingTimeStr = format(resultsProcessingDateTime, 'HH:mm');
                } else { resultsProcessingDateTime = undefined; }
            } catch (e) { resultsProcessingDateTime = undefined; }
        }

        form.reset({
          name: fetchedTournament.name, game: fetchedTournament.game, map: fetchedTournament.map || "", mode: fetchedTournament.mode as "Solo" | "Duo" | "Squad" | "Custom",
          entryFee: fetchedTournament.entryFee, prizePool: fetchedTournament.prizePool, perKillReward: fetchedTournament.perKillReward, maxPlayers: fetchedTournament.maxPlayers,
          startDate: tournamentDate, startTime: format(tournamentDate, 'HH:mm'), status: fetchedTournament.status as "upcoming" | "live" | "completed" | "archived",
          customRules: fetchedTournament.customRules || "", bannerImageUrl: fetchedTournament.bannerImageUrl || "", roomId: fetchedTournament.roomId || "", roomPassword: fetchedTournament.roomPassword || "",
          resultsProcessingTimeDate: resultsProcessingDateTime, resultsProcessingTimeTime: resultsProcessingTimeStr,
          autoPostResults: fetchedTournament.autoPostResults !== undefined ? fetchedTournament.autoPostResults : true,
        });
      } else {
        setFetchError("Tournament not found.");
        toast({ title: "Not Found", description: `Tournament with ID ${tournamentId} not found.`, variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error fetching tournament for edit:", err);
      let description = "Could not load tournament data for editing.";
      if (String(err.message).toUpperCase().includes("PERMISSION_DENIED")) description = "Permission Denied. Check Firebase rules for reading /tournaments/" + tournamentId;
      setFetchError(description);
      toast({ title: "Fetch Error", description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId, toast, form]);

  useEffect(() => { fetchAndSetTournamentData(); }, [fetchAndSetTournamentData]);

  const watchedResultsProcessingTimeDate = form.watch('resultsProcessingTimeDate');
  const watchedResultsProcessingTimeTime = form.watch('resultsProcessingTimeTime');
  const combinedResultsProcessingTimeISO = useMemo(() => {
    if (watchedResultsProcessingTimeDate && watchedResultsProcessingTimeTime) {
      const [hours, minutes] = watchedResultsProcessingTimeTime.split(':').map(Number);
      let combined = setHours(watchedResultsProcessingTimeDate, hours);
      combined = setMinutes(combined, minutes);
      combined = setSeconds(combined, 0);
      combined = setMilliseconds(combined, 0);
      return combined.toISOString();
    }
    return null;
  }, [watchedResultsProcessingTimeDate, watchedResultsProcessingTimeTime]);


  const handleAutoPostResults = useCallback(async () => {
    if (!database || !tournamentId) return;
    const currentStatusInForm = form.getValues('status');
    const hasAutoPosted = currentTournamentData?.autoPostCompleted === true;
    if (currentStatusInForm === 'completed' || hasAutoPosted) {
        console.log(`Auto-post skipped for tournament ${tournamentId}: Status is '${currentStatusInForm}', autoPostCompleted is ${hasAutoPosted}.`);
        return;
    }
    console.log("Auto-post results triggered for tournament:", tournamentId);
    const updates: Partial<Tournament> = { status: 'completed', resultsPosted: true, autoPostCompleted: true };
    try {
      await update(ref(database, `tournaments/${tournamentId}`), updates);
      form.setValue('status', 'completed');
      setCurrentTournamentData(prev => prev ? ({...prev, ...updates}) : null);
      toast({
        title: "Results Auto-Posted!",
        description: `Tournament "${form.getValues('name')}" status updated to completed and results marked as posted.`,
        variant: "default",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      });
    } catch (error) {
      console.error("Error auto-posting results:", error);
      toast({ title: "Auto-Post Failed", description: "Could not auto-post results.", variant: "destructive" });
    }
  }, [tournamentId, form, toast, currentTournamentData]);


  const onSubmit = async (data: TournamentFormValues) => {
    setIsSubmitting(true);
    if (!database) { toast({ title: "Error", description: "Firebase Database not initialized.", variant: "destructive" }); setIsSubmitting(false); return; }
    try {
      const [hours, minutes] = data.startTime.split(':').map(Number);
      let combinedDateTime = setHours(data.startDate, hours);
      combinedDateTime = setMinutes(combinedDateTime, minutes);
      combinedDateTime = setSeconds(combinedDateTime, 0);
      combinedDateTime = setMilliseconds(combinedDateTime, 0);
      const isoStartTime = combinedDateTime.toISOString();

      let isoResultsProcessingTime: string | null = null;
      if (data.resultsProcessingTimeDate && data.resultsProcessingTimeTime) {
        const [resHours, resMinutes] = data.resultsProcessingTimeTime.split(':').map(Number);
        let combinedResTime = setHours(data.resultsProcessingTimeDate, resHours);
        combinedResTime = setMinutes(combinedResTime, resMinutes);
        combinedResTime = setSeconds(combinedResTime, 0);
        combinedResTime = setMilliseconds(combinedResTime, 0);
        isoResultsProcessingTime = combinedResTime.toISOString();
      }
      
      const updatedTournamentData: Partial<Tournament> = {
        name: data.name, game: data.game, map: data.map || null, mode: data.mode, entryFee: data.entryFee, prizePool: data.prizePool,
        perKillReward: data.perKillReward || 0, maxPlayers: data.maxPlayers, status: data.status, startTime: isoStartTime,
        customRules: data.customRules || null, bannerImageUrl: data.bannerImageUrl || null, roomId: data.roomId || null, roomPassword: data.roomPassword || null,
        resultsProcessingTime: isoResultsProcessingTime, autoPostResults: data.autoPostResults,
      };

      await update(ref(database, `tournaments/${tournamentId}`), updatedTournamentData);
      toast({ title: "Tournament Updated!", description: `"${data.name}" has been successfully updated.`, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      router.push('/admin/tournaments');
    } catch (error) {
      console.error("Error updating tournament:", error);
      toast({ title: "Update Failed", description: "Could not update tournament. " + (error instanceof Error ? error.message : "Please try again."), variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-accent" /><p className="ml-4 text-lg">Loading tournament...</p></div>;
  if (fetchError) return <GlassCard className="m-4 p-6 text-center"><h2 className="text-xl font-semibold text-destructive mb-2">Error</h2><p className="text-muted-foreground mb-4">{fetchError}</p><Button variant="outline" asChild><Link href="/admin/tournaments"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></GlassCard>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Gamepad2 className="h-8 w-8 text-accent" /><div><h1 className="text-3xl font-bold text-foreground">Edit Tournament</h1><p className="text-muted-foreground">Modifying: {form.getValues('name') || 'Loading...'}</p></div></div><Button variant="outline" asChild><Link href="/admin/tournaments"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <GlassCard>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><CustomFormField name="name" label="Tournament Name" /><CustomFormField name="game" label="Game Title" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><CustomFormField name="map" label="Map (Optional)" /><Controller name="mode" control={form.control} render={({ field }) => ( <FormItem field={field} label="Game Mode"><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger className="bg-input/50"><SelectValue placeholder="Select mode" /></SelectTrigger></FormControl><SelectContent className="glass-card"><SelectItem value="Solo">Solo</SelectItem><SelectItem value="Duo">Duo</SelectItem><SelectItem value="Squad">Squad</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FormItem> )}/></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><CustomFormField name="maxPlayers" type="number" label="Max Players" /><Controller name="status" control={form.control} render={({ field }) => ( <FormItem field={field} label="Tournament Status"><Select onValueChange={field.onChange} value={field.value || "upcoming"}><FormControl><SelectTrigger className="bg-input/50"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent className="glass-card"><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></FormItem> )}/></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><CustomFormField name="entryFee" type="number" label="Entry Fee (Rs)" /><CustomFormField name="prizePool" type="number" label="Prize Pool (Rs)" /><CustomFormField name="perKillReward" type="number" label="Per Kill Reward (Rs)" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><CustomFormField name="startDate" type="date" label="Start Date" /><CustomFormField name="startTime" type="time" label="Start Time" /></div>
            
            <Separator className="my-4 bg-border/30" /><h3 className="text-lg font-semibold text-foreground -mb-2 flex items-center"><Clock className="mr-2 h-5 w-5 text-accent"/>Auto-Post Results Settings</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end"><CustomFormField name="resultsProcessingTimeDate" type="date" label="Auto-Post Date" /><CustomFormField name="resultsProcessingTimeTime" type="time" label="Auto-Post Time" /></div>
            <Controller name="autoPostResults" control={form.control} render={({ field }) => ( <div className="flex items-center space-x-2 pt-2"><Switch id="autoPostResultsToggle" checked={!!field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-accent" /><Label htmlFor="autoPostResultsToggle" className="text-sm font-medium text-foreground cursor-pointer flex items-center"><ToggleRight className="mr-2 h-4 w-4 text-muted-foreground"/>Enable Auto-Posting</Label></div> )}/>
            {combinedResultsProcessingTimeISO && isValid(parseISO(combinedResultsProcessingTimeISO)) && isFuture(parseISO(combinedResultsProcessingTimeISO)) && form.getValues('status') !== 'completed' && (<div className="mt-2 p-3 bg-muted/30 rounded-md"><p className="text-sm text-foreground mb-1">Time until auto-post:</p><CountdownTimer targetDate={combinedResultsProcessingTimeISO} onComplete={handleAutoPostResults} className="text-accent" size="md"/></div>)}
            <Separator className="my-4 bg-border/30" /><CustomFormField name="bannerImageUrl" label="Banner Image URL (Optional)" />
            <Separator className="my-4 bg-border/30" /><h3 className="text-lg font-semibold text-foreground -mb-2 flex items-center"><KeyRound className="mr-2 h-5 w-5 text-accent"/>Room Details (Optional)</h3><p className="text-xs text-muted-foreground -mt-2 mb-2">Details for joined players.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><CustomFormField name="roomId" label="Room ID" /><CustomFormField name="roomPassword" label="Room Password" /></div>
            <Separator className="my-4 bg-border/30" />
            <Controller name="customRules" control={form.control} render={({ field }) => ( <FormItem field={field} label="Custom Rules (Optional)"><Textarea placeholder="Enter custom rules..." className="resize-y min-h-[100px] bg-input/50" {...field} value={field.value || ''}/></FormItem> )}/>
            <div className="flex justify-end pt-4"><Button type="submit" className="neon-accent-bg" disabled={isSubmitting || isLoading}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}{isSubmitting ? 'Saving...' : 'Save Changes'}</Button></div>
          </form>
        </FormProvider>
      </GlassCard>
    </div>
  );
}
