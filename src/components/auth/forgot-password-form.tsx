
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, Send } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);
    if (!auth) {
      toast({ title: "System Error", description: "Firebase auth not initialized.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, data.email);
      toast({
        title: "Reset Link Sent",
        description: "If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).",
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
        duration: 7000, // Longer duration for this message
      });
      // Optionally redirect or clear form
      // router.push('/auth/login'); 
      form.reset();
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      let errorMessage = "Failed to send reset email. Please try again.";
      if (error.code === 'auth/user-not-found') {
        // To avoid user enumeration, show a generic message even if user not found
        errorMessage = "If an account exists for this email, a password reset link has been sent.";
         toast({ title: "Reset Link Sent", description: errorMessage, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30", duration: 7000 });
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
         toast({ title: "Input Error", description: errorMessage, variant: "destructive" });
      } else {
         toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
     
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Your Registered Email Address</FormLabel>
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
        <Button type="submit" className="w-full neon-accent-bg text-lg py-3 shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5"/>}
          {isLoading ? 'Sending Link...' : 'Send Reset Link'}
        </Button>
      </form>
    </Form>
  );
}
