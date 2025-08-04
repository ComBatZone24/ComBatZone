
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from "framer-motion";

// UI Components
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { User as UserIcon, Mail, Smartphone, KeyRound, Eye, EyeOff, Loader2, Gift, ChevronsRight, FileSignature, AlertCircle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { countryCodes } from "@/lib/country-codes";

// Firebase
import { auth, database } from '@/lib/firebase/config';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUserType } from '@/types';

// Form validation schema
const signupSchema = z.object({
  username: z.string().min(1, "Username cannot be empty."),
  email: z.string().email("Please enter a valid email."),
  countryCode: z.string().min(1, "Country code is required."),
  phone: z.string().min(5, "Please enter a valid phone number."),
  gameUid: z.string().min(1, "In-Game UID is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
  agreement: z.boolean().refine(val => val === true, { message: "You must agree to the terms." }),
  signature: z.string().min(3, "Please sign with your full name."),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

// Referral code generator
const generateReferralCode = (username: string) => {
  const namePart = username.substring(0, 4).toUpperCase().replace(/\s+/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePart}${randomSuffix}`;
};

const commonCountryCodes = [
    { name: 'Pakistan', dial_code: '+92', code: 'PK' },
    { name: 'India', dial_code: '+91', code: 'IN' },
    { name: 'Bangladesh', dial_code: '+880', code: 'BD' },
    { name: 'Saudi Arabia', dial_code: '+966', code: 'SA' },
    { name: 'United Kingdom', dial_code: '+44', code: 'GB' },
    { name: 'United States', dial_code: '+1', code: 'US' },
    { name: 'United Arab Emirates', dial_code: '+971', code: 'AE' },
];

export function SignupForm({ initialReferralCode }: { initialReferralCode?: string }) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      countryCode: "+92-PK",
      phone: "",
      gameUid: "",
      password: "",
      confirmPassword: "",
      referralCode: initialReferralCode || "",
      agreement: false,
      signature: "",
    },
  });

  const nextStep = async () => {
    let fieldsToValidate: (keyof SignupFormValues)[] = [];
    if (step === 1) fieldsToValidate = ["username"];
    if (step === 2) fieldsToValidate = ["email", "countryCode", "phone"];
    if (step === 3) fieldsToValidate = ["gameUid", "password", "confirmPassword", "referralCode"];

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
        if (step === 1) {
             const usernameSnapshot = await get(ref(database, `usernames/${form.getValues('username').toLowerCase()}`));
            if (usernameSnapshot.exists()) {
                form.setError("username", { type: "manual", message: "Username is already taken." });
                return;
            }
        }
        setStep(prev => prev + 1);
    }
  };

  const prevStep = () => setStep(prev => prev - 1);

  async function onSubmit(data: SignupFormValues) {
    if (step !== 4) return;
    setIsLoading(true);
    let firebaseUser = null; 

    try {
      if (!database || !auth) throw new Error("Firebase services are not initialized.");
      
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      firebaseUser = userCredential.user;

      const selectedDialCode = data.countryCode.split('-')[0];
      const ownReferralCode = generateReferralCode(data.username);

      const newUserRecord: AppUserType = {
        id: firebaseUser.uid,
        username: data.username,
        email: data.email,
        phone: `${selectedDialCode}${data.phone}`,
        wallet: 0, 
        tokenWallet: 0,
        role: 'user',
        isActive: true,
        lastLogin: new Date().toISOString(),
        onlineStreak: 1,
        createdAt: new Date().toISOString(),
        gameUid: data.gameUid,
        gameName: data.username, 
        referralCode: ownReferralCode,
        appliedReferralCode: data.referralCode?.trim().toUpperCase() || null,
        referralBonusReceived: 0,
        totalReferralCommissionsEarned: 0,
        watchAndEarnPoints: 0,
        location: null,
      };

      const usernameSnapshot = await get(ref(database, `usernames/${data.username.toLowerCase()}`));
      if (usernameSnapshot.exists()) {
          throw new Error("Username already taken");
      }
      
      await set(ref(database, `/users/${firebaseUser.uid}`), newUserRecord);
      await set(ref(database, `/usernames/${data.username.toLowerCase()}`), firebaseUser.uid);

      if (data.referralCode?.trim()) {
        try {
          const response = await fetch('/api/referral-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newUserId: firebaseUser.uid,
              referralCode: data.referralCode.trim().toUpperCase(),
            }),
          });
          const result = await response.json();
          if (response.ok) {
            toast({ title: "Referral Bonus Applied!", description: result.message, className: "bg-blue-500/20" });
          } else {
            toast({ title: "Referral Bonus Warning", description: result.message || "Could not apply referral bonus.", variant: "destructive" });
          }
        } catch (apiError) {
          console.error("API call to /api/referral-signup failed:", apiError);
          toast({ title: "Referral System Error", description: "Could not contact referral server. Bonus will be applied later.", variant: "destructive" });
        }
      }

      toast({ title: "Account Created!", description: "Welcome! You are now logged in.", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      router.push('/');

    } catch (error: any) {
      if (firebaseUser) await deleteUser(firebaseUser).catch(e => console.error("Failed to clean up user on signup error:", e));
      let errorMessage = "An unknown error occurred.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "This email is already registered.";
      else if (error.message === "Username already taken") errorMessage = "This username is already taken. Please choose another one.";
      else if (String(error.message).includes("PERMISSION_DENIED")) {
        errorMessage = "Permission denied. Please check database rules or contact support.";
      } else {
        console.error("Signup failed with error:", error);
      }
      toast({ title: "Signup Failed", description: errorMessage, variant: "destructive" });
      setStep(1); 
    } finally {
      setIsLoading(false);
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key={1} initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-foreground">What should we call you?</h2>
            <FormField name="username" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Username / In-Game Name</FormLabel><div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><FormControl><Input {...field} placeholder="Your unique name" className="pl-10"/></FormControl></div><FormMessage />
                </FormItem>
            )}/>
          </motion.div>
        );
      case 2:
        return (
            <motion.div key={2} initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="space-y-6">
             <h2 className="text-xl font-semibold text-center text-foreground">Contact Details</h2>
            <FormField name="email" control={form.control} render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><FormControl><Input {...field} type="email" placeholder="your@email.com" className="pl-10"/></FormControl></div><FormMessage /></FormItem>)}/>
            <div className="flex gap-2">
              <FormField name="countryCode" control={form.control} render={({ field }) => (
                <FormItem className="w-1/3"><FormLabel>Code</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                             <SelectValue />
                        </SelectTrigger>
                    </FormControl>
                  <SelectContent className="glass-card"><ScrollArea className="h-72">
                    {commonCountryCodes.map(c => 
                        <SelectItem key={`${c.dial_code}-${c.code}`} value={`${c.dial_code}-${c.code}`}>
                           {`${c.dial_code} ${c.code}`}
                        </SelectItem>
                    )}
                    <SelectSeparator/>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">More Countries</div>
                    {countryCodes.filter(c => !commonCountryCodes.some(cc => cc.code === c.code)).map(c => 
                        <SelectItem key={`${c.dial_code}-${c.code}`} value={`${c.dial_code}-${c.code}`}>
                           {`${c.dial_code} ${c.code}`}
                        </SelectItem>
                    )}
                  </ScrollArea></SelectContent></Select><FormMessage />
                </FormItem>
              )}/>
              <FormField name="phone" control={form.control} render={({ field }) => (<FormItem className="flex-grow"><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} type="tel" placeholder="3001234567"/></FormControl><FormMessage /></FormItem>)}/>
            </div>
          </motion.div>
        );
      case 3:
        return (
             <motion.div key={3} initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-foreground">Account Security</h2>
            <FormField name="gameUid" control={form.control} render={({ field }) => (<FormItem><FormLabel>In-Game UID</FormLabel><div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><FormControl><Input {...field} placeholder="Your ID from the game" className="pl-10"/></FormControl></div><FormMessage /></FormItem>)}/>
            <FormField name="password" control={form.control} render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" /></FormControl><FormMessage /></FormItem>)}/>
            <FormField name="confirmPassword" control={form.control} render={({ field }) => (<FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" /></FormControl><FormMessage /></FormItem>)}/>
            <FormField name="referralCode" control={form.control} render={({ field }) => (<FormItem><FormLabel>Referral Code (Optional)</FormLabel><div className="relative"><Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><FormControl><Input {...field} placeholder="Friend's referral code" className="pl-10"/></FormControl></div><FormMessage /></FormItem>)}/>
          </motion.div>
        );
      case 4:
        return (
            <motion.div key={4} initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-foreground">Final Agreement</h2>
            <div className="h-32 p-3 border rounded-md bg-background/50 text-xs text-muted-foreground overflow-y-auto">
                <p>By creating an account, you agree to our Terms of Service and Privacy Policy. You agree that you are responsible for any actions taken with your account. You understand that wallet transactions are final and refunds for digital goods or entry fees are not guaranteed. We reserve the right to suspend or terminate accounts for any violation of our rules, including cheating, harassment, or fraudulent activity. All decisions made by the administration are final.</p>
            </div>
             <FormField control={form.control} name="agreement" render={({ field }) => (
                <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="agreement" /></FormControl><Label htmlFor="agreement" className="text-sm font-normal text-muted-foreground cursor-pointer">I have read and agree to the terms.</Label><FormMessage />
                </FormItem>
             )}/>
             <FormField name="signature" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Digital Signature</FormLabel><div className="relative"><FileSignature className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><FormControl><Input {...field} placeholder="Type your full name to sign" className="pl-10"/></FormControl></div><FormMessage />
                </FormItem>
            )}/>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <AnimatePresence mode="wait">
            {renderStep()}
        </AnimatePresence>
        
        <div className="flex justify-between items-center pt-4">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1 || isLoading}>Back</Button>
          <div className="text-xs text-muted-foreground">Step {step} of 4</div>
          {step < 4 ? (
            <Button type="button" className="neon-accent-bg" onClick={nextStep} disabled={isLoading}><ChevronsRight className="mr-2"/>Next</Button>
          ) : (
            <Button type="submit" className="neon-accent-bg" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin"/> : 'Create Account'}</Button>
          )}
        </div>
      </form>
    </Form>
  );
}
