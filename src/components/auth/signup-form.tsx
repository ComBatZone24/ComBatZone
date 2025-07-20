
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React from "react";
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel, // FormLabel already imports Label internally, but direct usage needs its own import
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label"; // Added import for Label
import { User as UserIcon, Mail, Lock, Smartphone, Eye, EyeOff, Loader2, Gift, ShieldAlert } from 'lucide-react';
import Link from "next/link";

import { auth, database } from '@/lib/firebase/config';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, query, orderByChild, equalTo, get, runTransaction, push, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUserType, GlobalSettings, WalletTransaction } from '@/types';
import { getGeolocationData, getClientIpAddress } from '@/lib/firebase/geolocation';

const signupSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }).regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  agreeToTerms: z.boolean().refine(val => val === true, { message: "You must agree to the terms and conditions" }),
  referralCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const generateReferralCode = (username: string) => {
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${username.substring(0, 4).toUpperCase()}${randomSuffix}`;
};

interface SignupFormProps {
  initialReferralCode?: string;
}

export function SignupForm({ initialReferralCode }: SignupFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
      referralCode: initialReferralCode || "",
    },
  });

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true);
    if (!auth || !database) {
      toast({ title: "System Error", description: "Firebase services not initialized. Please try again later.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    let referrerUser: (AppUserType & { id: string }) | null = null;
    let globalSettings: GlobalSettings | null = null;
    let referralBonusAmount = 0;

    try {
      // Step 1: Check for duplicate username (case-insensitive)
      const lowercaseUsername = data.username.toLowerCase();
      const usernameRef = ref(database, `usernames/${lowercaseUsername}`);
      const usernameSnapshot = await get(usernameRef);
      if (usernameSnapshot.exists()) {
        form.setError("username", { type: "manual", message: "Username is already taken. Please choose another." });
        toast({ title: "Username Taken", description: "This username is not available.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const usersRef = ref(database, 'users');

      // Step 2: Fetch global settings to see if referrals are enabled and get the bonus amount
      const settingsRef = ref(database, 'globalSettings');
      const settingsSnapshot = await get(settingsRef);
      if (settingsSnapshot.exists()) {
        globalSettings = settingsSnapshot.val() as GlobalSettings;
        referralBonusAmount = globalSettings?.referralBonusAmount || 0;
      } else {
        console.warn("Global settings not found, referral bonus might not be applied.");
      }
      
      // Step 3: If a referral code was entered, validate it
      const enteredReferralCode = data.referralCode?.trim().toUpperCase();
      if (enteredReferralCode && globalSettings?.shareAndEarnEnabled && referralBonusAmount > 0) {
        const referrerQuery = query(usersRef, orderByChild('referralCode'), equalTo(enteredReferralCode));
        const referrerSnapshot = await get(referrerQuery);

        if (referrerSnapshot.exists()) {
          const referrerData = referrerSnapshot.val();
          const referrerId = Object.keys(referrerData)[0];
          referrerUser = { id: referrerId, ...referrerData[referrerId] };
        } else {
          // If code is invalid, inform user but allow signup to continue without bonus
          toast({ title: "Referral Info", description: "Invalid referral code provided. Proceeding without referral bonus.", variant: "default" });
        }
      }

      // Step 4: Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        
        // --- Geolocation Logic on Signup ---
        const ipAddress = await getClientIpAddress();
        const locationData = ipAddress ? await getGeolocationData(ipAddress) : null;
        
        // Step 5: Prepare new user data for Realtime Database
        const newUserReferralCode = generateReferralCode(data.username);
        const bonusForNewUser = (referrerUser && globalSettings?.shareAndEarnEnabled && referralBonusAmount > 0) ? referralBonusAmount : 0;
        const defaultAvatar = `https://placehold.co/100x100.png?text=${data.username.charAt(0).toUpperCase()}`;

        const newUserRecord: AppUserType = {
          id: firebaseUser.uid,
          username: data.username,
          email: firebaseUser.email || data.email,
          phone: data.phone || '',
          wallet: bonusForNewUser, // Award bonus if applicable
          role: "user",
          isActive: true,
          lastLogin: new Date().toISOString(),
          onlineStreak: 0,
          avatarUrl: defaultAvatar,
          gameUid: '',
          gameName: '',
          createdAt: new Date().toISOString(),
          watchAndEarnPoints: 0,
          referralCode: newUserReferralCode,
          appliedReferralCode: (referrerUser && globalSettings?.shareAndEarnEnabled && enteredReferralCode) ? enteredReferralCode : null,
          referralBonusReceived: bonusForNewUser,
          totalReferralCommissionsEarned: 0,
          location: locationData, // Save location data
        };
        
        // Step 6: Atomically save user data and claim username
        const updates: Record<string, any> = {};
        updates[`/users/${firebaseUser.uid}`] = newUserRecord;
        updates[`/usernames/${lowercaseUsername}`] = firebaseUser.uid; // Claim username
        
        await update(ref(database), updates);

        // Step 7: Log transaction for the new user if they received a bonus
        if (bonusForNewUser > 0) {
          const newRefereeTransaction: Omit<WalletTransaction, 'id'> = {
            type: 'referral_bonus_received', amount: bonusForNewUser, status: 'completed',
            date: new Date().toISOString(), description: `Referral bonus from ${referrerUser?.username || 'referrer'}`,
          };
          const refereeTxRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
          await push(refereeTxRef, newRefereeTransaction);
        }

        // Step 8: Update referrer's wallet and log their commission transaction
        if (referrerUser && globalSettings?.shareAndEarnEnabled && referralBonusAmount > 0) {
          const referrerUserRef = ref(database, `users/${referrerUser.id}`);
          await runTransaction(referrerUserRef, (currentReferrerData: AppUserType | null) => {
            if (currentReferrerData) {
              currentReferrerData.wallet = (currentReferrerData.wallet || 0) + referralBonusAmount;
              currentReferrerData.totalReferralCommissionsEarned = (currentReferrerData.totalReferralCommissionsEarned || 0) + referralBonusAmount;
            }
            return currentReferrerData;
          });
          
          const newReferrerTransaction: Omit<WalletTransaction, 'id'> = {
            type: 'referral_commission_earned', amount: referralBonusAmount, status: 'completed',
            date: new Date().toISOString(), description: `Referral commission for ${data.username}`,
          };
          const referrerTxRef = ref(database, `walletTransactions/${referrerUser.id}`);
          await push(referrerTxRef, newReferrerTransaction);
          toast({ title: "Referral Success!", description: `You and ${referrerUser.username} both received Rs ${referralBonusAmount}!`, variant: "default", className:"bg-green-500/20 text-green-300 border-green-500/30" });
        }
      }

      toast({ title: "Account Created!", description: "Welcome to ComBatZon! Please login to continue.", variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      router.push('/auth/login');

    } catch (error: any) {
      console.error("Signup Error:", error);
      let errorMessage = "Failed to create account. Please try again.";

       if (error.code === 'PERMISSION_DENIED') {
          errorMessage = "This username was just claimed. Please choose another.";
          form.setError("username", { type: "manual", message: errorMessage });
       } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already registered. Please use a different email or login.";
        form.setError("email", { type: "manual", message: errorMessage });
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. It must be at least 6 characters.";
        form.setError("password", { type: "manual", message: errorMessage });
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
        form.setError("email", { type: "manual", message: errorMessage });
      }
      toast({ title: "Signup Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Username</FormLabel>
              <div className="relative group">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input placeholder="Choose a unique username" {...field} className="pl-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Email Address</FormLabel>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input type="email" placeholder="your@email.com" {...field} className="pl-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Phone Number (Optional)</FormLabel>
              <div className="relative group">
                <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input type="tel" placeholder="03001234567" {...field} className="pl-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Password</FormLabel>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" {...field} className="pl-10 pr-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-accent" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Confirm Password</FormLabel>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input type={showConfirmPassword ? "text" : "password"} placeholder="Re-type password" {...field} className="pl-10 pr-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-accent" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="referralCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Referral Code (Optional)</FormLabel>
              <div className="relative group">
                <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input placeholder="Enter friend's code for a bonus" {...field} className="pl-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2.5 space-y-0 pt-2">
              <FormControl>
                <Checkbox
                  id="agreeToTermsSignup"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-primary data-[state=checked]:bg-accent data-[state=checked]:border-accent h-5 w-5"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label htmlFor="agreeToTermsSignup" className="font-normal text-muted-foreground text-sm cursor-pointer">
                  I agree to the <Link href="/terms" legacyBehavior><a className="text-accent hover:underline">Terms and Conditions</a></Link>
                </Label>
                 <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full neon-accent-bg text-lg py-3 mt-6 shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin mr-2" /> : <ShieldAlert className="mr-2 h-5 w-5"/>}
          {isLoading ? 'Creating Account...' : 'Create My Account'}
        </Button>
      </form>
    </Form>
  );
}

  