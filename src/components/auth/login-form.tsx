
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { auth, database } from '@/lib/firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUserType } from '@/types';
import { adminNavItems } from '@/config/nav';
import { getClientIpAddress, getGeolocationData } from '@/lib/firebase/geolocation';

const loginSchema = z.object({
  emailOrPhone: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrPhone: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    if (!auth) {
      toast({ title: "System Error", description: "Firebase auth service not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.emailOrPhone, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        let userRole = 'user'; 
        let userProfileData: AppUserType | null = null;
        
        if (database) {
            const userRef = ref(database, `users/${firebaseUser.uid}`);
            
            // --- Geolocation Logic moved HERE to run on CLIENT ---
            const ipAddress = await getClientIpAddress();
            const locationData = ipAddress ? await getGeolocationData(ipAddress) : null;
            
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) {
              userProfileData = { id: firebaseUser.uid, ...userSnapshot.val() } as AppUserType;
              userRole = userProfileData.role || 'user';

              const today = new Date();
              today.setHours(0, 0, 0, 0); 
              let newStreak = 1;
              const lastLoginString = userProfileData.lastLogin;
              if (lastLoginString) {
                const lastLoginDate = new Date(lastLoginString);
                lastLoginDate.setHours(0, 0, 0, 0);
                const diffInDays = Math.round((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffInDays === 0) newStreak = userProfileData.onlineStreak || 1; 
                else if (diffInDays === 1) newStreak = (userProfileData.onlineStreak || 0) + 1;
              }
              
              await update(userRef, {
                lastLogin: new Date().toISOString(),
                onlineStreak: newStreak,
                location: locationData, // Save location data
              });
            } else {
              const basicProfile = {
                email: firebaseUser.email,
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User',
                role: 'user',
                isActive: true,
                lastLogin: new Date().toISOString(),
                onlineStreak: 1,
                createdAt: new Date().toISOString(),
                wallet: 0,
                location: locationData, // Save location data on creation
              };
              await update(userRef, basicProfile);
              userProfileData = { id: firebaseUser.uid, ...basicProfile };
            }
        }

        toast({ title: "Login Successful", description: "Welcome back to ComBatZon!", variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
        
        if (userRole === 'admin') {
            window.location.assign('/admin/dashboard');
        } else if (userRole === 'delegate' && userProfileData?.delegatePermissions) {
            const permissions = userProfileData.delegatePermissions.accessScreens || {};
            const firstAllowedPage = adminNavItems.find(item => item.permissionKey && permissions[item.permissionKey]);
            if (firstAllowedPage) {
                window.location.assign(firstAllowedPage.href);
            } else {
                toast({ title: "No Permissions", description: "You have not been assigned any delegate permissions.", variant: "destructive" });
                window.location.assign('/');
            }
        } else {
            window.location.assign('/');
        }
      } else {
        toast({ title: "Login Error", description: "Could not retrieve user details after login.", variant: "destructive" });
      }

    } catch (error: any) {
      console.error("Login Error:", error);
      let errorMessage = "Failed to login. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later or reset your password.";
      }
      toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="emailOrPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Email Address</FormLabel>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                <FormControl>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    {...field}
                    className="pl-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner"
                  />
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
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...field}
                    className="pl-10 pr-10 py-3 text-base bg-background/70 border-border/50 focus:border-accent focus:ring-accent/50 shadow-inner"
                  />
                </FormControl>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-accent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between text-sm">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2.5 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-primary data-[state=checked]:bg-accent data-[state=checked]:border-accent h-5 w-5"
                    id="rememberMeLogin"
                  />
                </FormControl>
                <Label htmlFor="rememberMeLogin" className="font-normal text-muted-foreground cursor-pointer">
                    Remember me
                </Label>
              </FormItem>
            )}
          />
          <Link href="/auth/forgot-password" legacyBehavior>
            <a className="text-accent hover:underline hover:text-accent/80 transition-colors">Forgot password?</a>
          </Link>
        </div>
        <Button type="submit" className="w-full neon-accent-bg text-lg py-3 shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : 'Enter Arena'}
        </Button>
      </form>
    </Form>
  );
}
