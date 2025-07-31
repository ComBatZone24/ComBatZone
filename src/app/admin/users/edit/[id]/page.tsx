
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Loader2, Edit3Icon, UserCircle, AlertCircle } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, get, update } from 'firebase/database';
import type { User } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const editUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters.").max(30, "Username too long."),
  email: z.string().email("Invalid email format.").optional(), // Usually not editable by admin directly
  phone: z.string().optional().or(z.literal('')),
  wallet: z.coerce.number().min(0, "Wallet balance cannot be negative."),
  role: z.enum(["user", "admin", "delegate"]),
  isActive: z.boolean(),
  gameName: z.string().optional().or(z.literal('')),
  gameUid: z.string().optional().or(z.literal('')),
  referralCode: z.string().optional().or(z.literal('')), // Admins might want to assign/change
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function AdminEditUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialUserData, setInitialUserData] = useState<User | null>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { // Will be overridden
      username: "",
      email: "",
      phone: "",
      wallet: 0,
      role: "user",
      isActive: false,
      gameName: "",
      gameUid: "",
      referralCode: "",
    },
  });

  const fetchUserData = useCallback(async () => {
    if (!userId || !database) {
      setFetchError("Invalid user ID or database not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const fetchedUser = snapshot.val() as User;
        setInitialUserData(fetchedUser);
        form.reset({
          username: fetchedUser.username || "",
          email: fetchedUser.email || "", // Display email, but it's typically not directly edited
          phone: fetchedUser.phone || "",
          wallet: fetchedUser.wallet || 0,
          role: fetchedUser.role === 'admin' ? 'admin' : fetchedUser.role === 'delegate' ? 'delegate' : 'user',
          isActive: fetchedUser.isActive !== undefined ? fetchedUser.isActive : false,
          gameName: fetchedUser.gameName || "",
          gameUid: fetchedUser.gameUid || "",
          referralCode: fetchedUser.referralCode || "",
        });
      } else {
        setFetchError("User not found.");
        toast({ title: "Not Found", description: `User with ID ${userId} not found.`, variant: "destructive" });
      }
    } catch (err: any) {
      setFetchError(err.message || "Could not load user data.");
      toast({ title: "Fetch Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast, form]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const onSubmit = async (data: EditUserFormValues) => {
    setIsSubmitting(true);
    if (!initialUserData) {
        toast({title: "Error", description: "Original user data not loaded. Cannot save.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }
    if (!database) {
        toast({title: "Firebase Error", description: "Database not initialized.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    try {
      const updates: Partial<User> = {
        username: data.username,
        phone: data.phone || null,
        wallet: data.wallet,
        role: data.role,
        isActive: data.isActive,
        gameName: data.gameName || null,
        gameUid: data.gameUid || null,
        referralCode: data.referralCode || null,
      };

      await update(ref(database, `users/${userId}`), updates);
      
      const previousIsActive = initialUserData.isActive;
      const currentIsActive = data.isActive;
      const usernameForToast = data.username || initialUserData.username;

      if (currentIsActive === false && previousIsActive === true) {
          // User was active and is now banned
          toast({
              title: "User Banned",
              description: `${usernameForToast}'s account has been deactivated. For appeals, please contact admin on WhatsApp.`,
              variant: "destructive",
              duration: 10000, 
          });
      } else if (currentIsActive === true && previousIsActive === false) {
          // User was banned and is now unbanned
          toast({
              title: "User Unbanned",
              description: `${usernameForToast}'s account has been reactivated.`,
              variant: "default",
              className: "bg-green-500/20 text-green-300 border-green-500/30",
          });
      } else {
          // Generic update if isActive status didn't change in a way that triggers ban/unban messages
          toast({
              title: "User Updated",
              description: `${usernameForToast}'s details have been saved.`,
              variant: "default",
          });
      }
      
      router.push('/admin/users');
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Could not save changes.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-accent" /><p className="ml-4 text-lg">Loading user editor...</p></div>;
  }

  if (fetchError || !initialUserData) {
    return <GlassCard className="m-4 p-6 text-center"><h2 className="text-xl font-semibold text-destructive mb-2">Error</h2><p className="text-muted-foreground mb-4">{fetchError || "User data missing."}</p><Button variant="outline" asChild><Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></GlassCard>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Edit3Icon className="h-8 w-8 text-accent" />
            <div>
                <h1 className="text-3xl font-bold text-foreground">Edit User</h1>
                <p className="text-muted-foreground">Modifying profile for: {initialUserData.username}</p>
            </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
          </Link>
        </Button>
      </div>

      <GlassCard>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField name="username" label="Username" control={form.control} />
            <FormItemStatic label="Email Address" value={initialUserData.email || 'N/A'} />
          </div>

          <FormField name="phone" label="Phone Number" control={form.control} placeholder="e.g., 03001234567" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField name="wallet" type="number" label="Wallet Balance (Rs)" control={form.control} />
          </div>
          
          <Separator className="my-4 bg-border/30" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <Controller
              name="role"
              control={form.control}
              render={({ field }) => (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">User Role</Label>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full mt-1 bg-input/50 border-border/70 focus:border-accent">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="delegate">Delegate</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && <p className="text-xs text-destructive mt-1">{form.formState.errors.role.message}</p>}
                </div>
              )}
            />
             <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center space-x-3 pt-5">
                    <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-accent"
                    />
                    <Label htmlFor="isActive" className="text-md font-medium text-foreground cursor-pointer">
                        User is Active
                    </Label>
                </div>
              )}
            />
          </div>

          <Separator className="my-4 bg-border/30" />
          <h3 className="text-md font-semibold text-foreground -mb-2">Game &amp; Referral Info</h3>

          <FormField name="gameName" label="In-Game Name (IGN)" control={form.control} placeholder="User's IGN" />
          <FormField name="gameUid" label="In-Game UID" control={form.control} placeholder="User's game UID" />
          <FormField name="referralCode" label="User's Referral Code" control={form.control} placeholder="e.g., USERABCD" />
          
          <div className="flex justify-end pt-4">
            <Button type="submit" className="neon-accent-bg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

interface FormFieldProps {
  name: keyof EditUserFormValues;
  label: string;
  control: ReturnType<typeof useForm<EditUserFormValues>>['control'];
  type?: string;
  placeholder?: string;
}

const FormField: React.FC<FormFieldProps> = ({ name, label, control, type = "text", placeholder }) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState: { error } }) => (
      <div>
        <Label htmlFor={name} className="text-sm font-medium text-muted-foreground">{label}</Label>
        <Input
          id={name} type={type} placeholder={placeholder}
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
          {...field}
          value={field.value || ''} // Ensure value is not undefined/null for input
          onChange={(e) => {
            if (type === 'number') {
              const val = e.target.value;
              field.onChange(val === '' ? undefined : parseFloat(val)); // Keep it as number or undefined for zod
            } else {
              field.onChange(e.target.value);
            }
          }}
        />
        {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
      </div>
    )}
  />
);

const FormItemStatic: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div>
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    <p className="mt-1 text-foreground p-2 bg-input/30 border border-border/50 rounded-md text-sm">{value}</p>
  </div>
);
