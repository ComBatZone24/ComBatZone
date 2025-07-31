
"use client";

import { useEffect, useState, FormEvent, useCallback } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { User as AppUserType, GlobalSettings } from '@/types';
import { Edit3, Save, X, AlertTriangle, LogIn, CreditCard, Loader2, KeyRound, Copy, Share2, Link as LinkIcon, Facebook, Instagram, Youtube, MessageSquare, Mail, Gift, UserCircle, Globe, Shield, LogOut as LogOutIcon, Bell, UserRound, Lock, Link2 } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { database, auth } from '@/lib/firebase/config';
import { ref, get, update, runTransaction, query, orderByChild, equalTo, push, onValue, off } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const socialIconMap: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  email: Mail,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
};

const generateReferralCode = (username: string) => {
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${username.substring(0, 4).toUpperCase()}${randomSuffix}`;
};


export default function ProfilePage() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUserType | null>(null);
  const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<AppUserType>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);

  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [friendReferralCodeInput, setFriendReferralCodeInput] = useState('');
  

  const fetchUserData = useCallback(async (user: FirebaseUser) => {
    setIsLoading(true);
    if (!database) {
      console.warn("ProfilePage: Firebase Database not available for user data.");
      setAppUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const userRefDb = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRefDb);
      let mergedProfile: AppUserType;

      if (snapshot.exists()) {
        const fetchedData = snapshot.val();
        let userReferralCode = fetchedData.referralCode;

        if (!userReferralCode) {
            console.log(`User ${user.uid} is missing a referral code. Generating one.`);
            const usernameForCode = fetchedData.username || user.displayName || user.email?.split('@')[0] || 'USER';
            userReferralCode = generateReferralCode(usernameForCode);
            update(userRefDb, { referralCode: userReferralCode }).catch(err => {
                console.error("Failed to save new referral code:", err);
            });
        }
        
        mergedProfile = {
          id: user.uid,
          email: user.email || '',
          username: fetchedData.username || user.displayName || 'User',
          role: 'user',
          ...fetchedData,
          referralCode: userReferralCode,
        };
      } else {
        console.warn(`ProfilePage: User data for ${user.uid} not found in Firebase. Creating default profile.`);
        const newUsername = user.displayName || user.email?.split('@')[0] || 'User';
         mergedProfile = {
            id: user.uid,
            username: newUsername,
            email: user.email || '',
            phone: '',
            wallet: 0,
            tokenWallet: 0,
            role: 'user',
            isActive: true,
            lastLogin: new Date().toISOString(),
            onlineStreak: 1,
            createdAt: new Date().toISOString(),
            gameUid: null,
            gameName: null,
            referralCode: generateReferralCode(newUsername),
            appliedReferralCode: null,
            referralBonusReceived: 0,
            totalReferralCommissionsEarned: 0,
            watchAndEarnPoints: 0,
        };
      }
      setAppUser(mergedProfile);
      setFormData(mergedProfile);
    } catch (error) {
      console.error("ProfilePage: Error fetching user data:", error);
      toast({ title: "Profile Error", description: "Could not load your profile details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchGlobalSettings = useCallback(() => {
    setIsLoadingSettings(true);
    if (!database) return;
    const settingsRefDb = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRefDb, (snapshot) => {
      setGlobalSettings(snapshot.exists() ? snapshot.val() : {});
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      setGlobalSettings({});
      setIsLoadingSettings(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubAuth: () => void = () => {};
    let unsubSettings: () => void = () => {};
  
    const init = async () => {
      unsubSettings = fetchGlobalSettings();
      if (auth) {
        unsubAuth = onAuthStateChanged(auth, async (user) => {
          setFirebaseUser(user);
          if (user) await fetchUserData(user);
          else { setAppUser(null); setIsLoading(false); }
        });
      } else {
        setIsLoading(false);
      }
    };
    
    init();
    return () => { unsubAuth(); unsubSettings(); };
  }, [fetchUserData, fetchGlobalSettings]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    if (isEditing && appUser) {
      setFormData(appUser);
    }
    setIsEditing(!isEditing);
  };

  const validateFormData = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.username || formData.username.trim() === '') errors.username = 'Username is required.';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  useEffect(() => { validateFormData(); }, [formData, validateFormData]);

  const handleSaveChanges = async () => {
    if (!firebaseUser || !formData || !appUser) return;
    setIsSaving(true);
    try {
      if (!database) throw new Error("Firebase Database not initialized for saving profile.");
      if (!firebaseUser.uid) throw new Error("User UID is missing.");

      const userRef = ref(database, `users/${firebaseUser.uid}`);
      
      const updates: Partial<AppUserType> = {
        username: formData.username || appUser.username,
        phone: formData.phone || appUser.phone || null,
        gameName: formData.gameName || appUser.gameName || null,
        gameUid: formData.gameUid || appUser.gameUid || null,
      };
      await update(userRef, updates);
      
      setAppUser(prev => prev ? ({ ...prev, ...updates }) : null);
      toast({ title: "Profile Updated", description: "Your changes have been saved.", variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: "Could not save changes. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    if (newPassword !== confirmNewPassword) { toast({ title: "Password Mismatch", description: "New passwords do not match.", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" }); return; }

    setIsPasswordUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      toast({ title: "Password Updated", description: "Your password has been changed successfully.", variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (error: any) {
      let errorMessage = "Failed to update password.";
      if (error.code === 'auth/wrong-password') errorMessage = "Incorrect current password.";
      else if (error.code === 'auth/requires-recent-login') errorMessage = "This action requires a recent login. Please log out and log back in.";
      else if (error.code === 'auth/too-many-requests') errorMessage = "Too many attempts. Please try again later.";
      toast({ title: "Password Update Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try { await signOut(auth); window.location.assign('/auth/login'); } 
    catch (error) { toast({ title: "Logout Failed", description: "Could not log you out completely. Please try again.", variant: "destructive" }); }
  };

  const handleShare = async () => {
    if (!appUser || !appUser.referralCode || !globalSettings) {
      toast({ title: "Cannot Share", description: "Your referral information is not available.", variant: "destructive" });
      return;
    }

    const shareLinkBase = globalSettings.shareLinkBaseUrl || window.location.origin;
    const referralLink = `${shareLinkBase}?ref=${appUser.referralCode}`;
    const shareTitle = `Join me on ${globalSettings.appName || 'Arena Ace'}!`;
    const shareText = `Hey! Join me on ${globalSettings.appName || 'Arena Ace'}, the best eSports app in Pakistan, and let's win together! Use my link to get a special bonus:`;

    if (navigator.share) {
      // Use Web Share API on mobile
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n${referralLink}`,
          url: referralLink,
        });
        toast({ title: "Thanks for sharing!" });
      } catch (error) {
        console.error('Error sharing:', error);
        toast({ title: "Share Canceled", description: "The share dialog was closed.", variant: "default" });
      }
    } else {
      // Fallback for desktop: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${referralLink}`);
        toast({ title: "Link Copied!", description: "Your referral link has been copied to the clipboard." });
      } catch (err) {
        console.error('Failed to copy: ', err);
        toast({ title: "Copy Failed", description: "Could not copy the link to your clipboard.", variant: "destructive" });
      }
    }
  };


  if (isLoading || isLoadingSettings) return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-16 w-16 animate-spin text-accent" /><p className="ml-4 text-lg">Loading profile...</p></div>;

  if (!firebaseUser) return <div className="text-center py-20"><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><h1 className="text-2xl font-semibold mb-2">Access Denied</h1><p className="mb-6">You need to be logged in to view your profile.</p><Button variant="default" asChild><Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" />Login</Link></Button></div>;

  if (!appUser) return <div className="text-center py-20"><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><h1 className="text-2xl font-semibold mb-2">Profile Data Not Found</h1><p className="mb-6">We couldn't retrieve your profile details. Please try again or contact support.</p><Button variant="outline" asChild><Link href="/">Go Home</Link></Button></div>;

  const displayUser = isEditing ? formData : appUser;

  return (
    <div className="space-y-8 pt-8">
      <GlassCard interactive className="p-6 md:p-8 text-center border-2 border-accent/30 shadow-accent/10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/20 to-transparent"></div>
        <div className="relative group w-36 h-36 mx-auto mb-4">
          <Avatar className="h-full w-full border-4 border-accent shadow-lg shadow-accent/20"><AvatarImage src={appUser.avatarUrl || undefined} alt={appUser.username} data-ai-hint="user avatar"/><AvatarFallback className="text-6xl">{appUser.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
        </div>
        <h2 className="text-3xl font-bold text-foreground">{appUser.username}</h2>
        <p className="text-muted-foreground">{appUser.email}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
            <div className="text-center p-3 rounded-md bg-muted/40 flex-1">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold text-green-400 flex items-center justify-center"><RupeeIcon className="mr-1 h-5" />{(appUser.wallet ?? 0).toFixed(2)}</p>
            </div>
            {globalSettings?.tokenSettings?.enabled && (
                <div className="text-center p-3 rounded-md bg-muted/40 flex-1">
                    <p className="text-sm text-muted-foreground">{globalSettings.tokenSettings.tokenSymbol || 'Tokens'}</p>
                    <p className="text-2xl font-bold text-accent">{(appUser.tokenWallet || 0).toLocaleString()}</p>
                </div>
            )}
        </div>
      </GlassCard>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account"><UserRound className="mr-2 h-4 w-4"/>Account</TabsTrigger>
          <TabsTrigger value="security"><Lock className="mr-2 h-4 w-4"/>Security</TabsTrigger>
          <TabsTrigger value="referrals"><Link2 className="mr-2 h-4 w-4"/>Referrals</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <GlassCard className="p-6 md:p-8 mt-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-foreground">Account Information</h3>
                {!isEditing && <Button variant="ghost" size="sm" className="text-accent" onClick={handleEditToggle}><Edit3 className="mr-2 h-4 w-4" /> Edit Profile</Button>}
              </div>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div><Label htmlFor="username">Username</Label><Input id="username" name="username" value={displayUser.username || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className="mt-1 bg-input/30"/></div>
                      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={displayUser.email || ''} readOnly disabled className="mt-1 bg-input/30 opacity-70"/></div>
                      <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" value={displayUser.phone || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className="mt-1 bg-input/30"/></div>
                      <div><Label htmlFor="gameName">In-Game Name</Label><Input id="gameName" name="gameName" value={displayUser.gameName || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className="mt-1 bg-input/30"/></div>
                      <div><Label htmlFor="gameUid">In-Game UID</Label><Input id="gameUid" name="gameUid" value={displayUser.gameUid || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className="mt-1 bg-input/30"/></div>
                  </div>
                  {isEditing && (<div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={handleEditToggle} disabled={isSaving}><X className="mr-2 h-4 w-4" /> Cancel</Button><Button type="button" onClick={handleSaveChanges} disabled={isSaving} className="neon-accent-bg">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save</Button></div>)}
              </form>
          </GlassCard>
        </TabsContent>
        
        <TabsContent value="security">
           <GlassCard className="p-6 md:p-8 mt-4">
              <h3 className="text-xl font-semibold text-foreground mb-6">Change Password</h3>
              <form onSubmit={handleChangePassword} className="space-y-6">
                  <div><Label htmlFor="currentPassword">Current Password</Label><Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 bg-input/30"/></div>
                  <div><Label htmlFor="newPassword">New Password</Label><Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 bg-input/30"/></div>
                  <div><Label htmlFor="confirmNewPassword">Confirm New Password</Label><Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-1 bg-input/30"/></div>
                  <div className="pt-2 flex justify-end"><Button type="submit" className="neon-accent-bg" disabled={isPasswordUpdating}>{isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Password</Button></div>
              </form>
           </GlassCard>
        </TabsContent>

        <TabsContent value="referrals">
          <GlassCard className="p-6 md:p-8 mt-4">
            <h3 className="text-xl font-semibold text-foreground mb-6">Referral Program</h3>
             {appUser.referralCode && (
                  <div className="space-y-4">
                     <Label>Your Referral Code</Label>
                    <div className="flex items-center space-x-2 p-2 bg-input/50 rounded-md border">
                        <Input value={appUser.referralCode} readOnly className="font-mono tracking-wider border-0 bg-transparent"/>
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(appUser.referralCode || '')}><Copy className="h-4 w-4"/></Button>
                    </div>
                    <Button onClick={handleShare} className="w-full neon-accent-bg">
                      <Share2 className="mr-2 h-4 w-4" /> Share App
                    </Button>
                </div>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
      
      <GlassCard className="text-center p-6 mt-8">
        <Button variant="destructive" onClick={handleLogout} className="w-full max-w-sm mx-auto"><LogOutIcon className="mr-2 h-5 w-5"/> Log Out</Button>
      </GlassCard>
    </div>
  );
}
