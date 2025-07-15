
"use client";

import { useEffect, useState, FormEvent, useCallback } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { User as AppUserType, GlobalSettings } from '@/types';
import { Edit3, Save, X, AlertTriangle, LogIn, CreditCard, Loader2, KeyRound, Copy, Share2, Link as LinkIcon, Facebook, Instagram, Youtube, MessageSquare, Mail, Gift, UserCircle, Globe, Shield, LogOut as LogOutIcon } from 'lucide-react';
import RupeeIcon from '@/components/core/rupee-icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { database, auth, app } from '@/lib/firebase/config';
import { ref, get, update, runTransaction, query, orderByChild, equalTo, push, onValue, off } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { LucideIcon } from 'lucide-react';
import { mockGlobalSettings, defaultAppUser as defaultUserProfileMock } from '@/lib/mock-data'; 
import { Alert, AlertTitle } from '@/components/ui/alert';
import { adminNavItems } from '@/config/nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';


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

        // Auto-generate and save referral code if it's missing for an existing user
        if (!userReferralCode) {
            console.log(`User ${user.uid} is missing a referral code. Generating one.`);
            const usernameForCode = fetchedData.username || user.displayName || user.email?.split('@')[0] || 'USER';
            userReferralCode = generateReferralCode(usernameForCode);
            // Asynchronously update the database, don't block the UI
            update(userRefDb, { referralCode: userReferralCode }).catch(err => {
                console.error("Failed to save new referral code:", err);
            });
        }
        
        mergedProfile = {
          ...defaultUserProfileMock,
          id: user.uid,
          email: user.email || fetchedData.email || defaultUserProfileMock.email,
          username: fetchedData.username || user.displayName || user.email?.split('@')[0] || defaultUserProfileMock.username,
          ...fetchedData,
          referralCode: userReferralCode, // Use the existing or newly generated code
          wallet: fetchedData.wallet !== undefined ? fetchedData.wallet : defaultUserProfileMock.wallet,
          appliedReferralCode: fetchedData.appliedReferralCode !== undefined ? fetchedData.appliedReferralCode : defaultUserProfileMock.appliedReferralCode,
          referralBonusReceived: fetchedData.referralBonusReceived !== undefined ? fetchedData.referralBonusReceived : defaultUserProfileMock.referralBonusReceived,
          totalReferralCommissionsEarned: fetchedData.totalReferralCommissionsEarned !== undefined ? fetchedData.totalReferralCommissionsEarned : defaultUserProfileMock.totalReferralCommissionsEarned,
        };
      } else {
        console.warn(`ProfilePage: User data for ${user.uid} not found in Firebase. Creating default profile.`);
        const newUsername = user.displayName || user.email?.split('@')[0] || defaultUserProfileMock.username;
         mergedProfile = {
            ...defaultUserProfileMock,
            id: user.uid,
            email: user.email || '',
            username: newUsername,
            role: 'user',
            isActive: true,
            lastLogin: new Date().toISOString(),
            wallet: 0,
            referralCode: generateReferralCode(newUsername),
            appliedReferralCode: null,
            referralBonusReceived: 0,
            totalReferralCommissionsEarned: 0,
            createdAt: new Date().toISOString(),
        };
      }
      setAppUser(mergedProfile);
      setFormData(mergedProfile);
    } catch (error) {
      console.error("ProfilePage: Error fetching user data:", error);
      toast({ title: "Profile Error", description: "Could not load your profile details.", variant: "destructive" });
      setAppUser({ ...defaultUserProfileMock, id: user.uid, email: user.email || '' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchGlobalSettings = useCallback(() => {
    setIsLoadingSettings(true);
    if (!database) {
      console.warn("Firebase Database not available for global settings.");
      setGlobalSettings(mockGlobalSettings);
      setIsLoadingSettings(false);
      return;
    }
    const settingsRefDb = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRefDb, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setGlobalSettings({
          ...mockGlobalSettings,
          ...data,
        });
      } else {
        console.warn("Global settings not found, using defaults");
        setGlobalSettings(mockGlobalSettings);
      }
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      toast({
        title: "Settings Error",
        description: "Could not load global settings.",
        variant: "destructive",
      });
      setGlobalSettings(mockGlobalSettings);
      setIsLoadingSettings(false);
    });

    return unsubscribe;
  }, [toast]);

  useEffect(() => {
    let unsubAuth: () => void = () => {};
    let unsubSettings: () => void = () => {};
  
    const init = async () => {
      unsubSettings = fetchGlobalSettings();
      if (auth) {
        unsubAuth = onAuthStateChanged(auth, async (user) => {
          setFirebaseUser(user);
          if (user) await fetchUserData(user);
          else setAppUser(null);
        });
      }
    };
    
    init();
    return () => {
      unsubAuth();
      if (unsubSettings) unsubSettings();
    };
  }, [toast, fetchUserData, fetchGlobalSettings]);


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
    if (!formData.username || formData.username.trim() === '') {
      errors.username = 'Username is required.';
    }
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

      const leaderboardRef = ref(database, `leaderboards/${firebaseUser.uid}`);
      const leaderboardSnapshot = await get(leaderboardRef);

      if (leaderboardSnapshot.exists()) {
        const leaderboardUpdates = {
          username: updates.username,
          inGameName: updates.gameName,
        };
        await update(leaderboardRef, leaderboardUpdates);
      }
      
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
    if (!firebaseUser || !firebaseUser.email) {
      toast({ title: "Auth Error", description: "User not properly authenticated or email missing.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Password Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsPasswordUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      toast({ title: "Password Updated", description: "Your password has been changed successfully.", variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      console.error("Password update error:", error);
      let errorMessage = "Failed to update password.";
      if (error.code === 'auth/wrong-password') errorMessage = "Incorrect current password.";
      else if (error.code === 'auth/requires-recent-login') errorMessage = "This action requires a recent login. Please log out and log back in.";
      else if (error.code === 'auth/too-many-requests') errorMessage = "Too many attempts. Please try again later.";
      toast({ title: "Password Update Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  const handleApplyReferralCode = async () => {
    if (!firebaseUser || !appUser || !globalSettings || !database) {
        toast({ title: "Error", description: "User or settings not loaded.", variant: "destructive" });
        return;
    }
    if (!friendReferralCodeInput.trim()) {
        toast({ title: "Input Error", description: "Please enter a referral code.", variant: "destructive" });
        return;
    }
    if (appUser.referralCode && friendReferralCodeInput.trim().toUpperCase() === appUser.referralCode) {
        toast({ title: "Invalid Code", description: "You cannot use your own referral code.", variant: "destructive" });
        return;
    }

    setIsApplyingReferral(true);
    const friendCode = friendReferralCodeInput.trim().toUpperCase();
    const bonusAmount = globalSettings.referralBonusAmount || 0;

    if (!globalSettings.shareAndEarnEnabled || bonusAmount <=0) {
      toast({ title: "Referral Disabled", description: "Referral bonus is not active at the moment.", variant: "default" });
      setIsApplyingReferral(false);
      return;
    }

    try {
        const usersRef = ref(database, 'users');
        const referrerQuery = query(usersRef, orderByChild('referralCode'), equalTo(friendCode));
        const referrerSnapshot = await get(referrerQuery);

        if (!referrerSnapshot.exists()) {
            toast({ title: "Invalid Code", description: "This referral code does not exist.", variant: "destructive" });
            setIsApplyingReferral(false);
            return;
        }

        let referrerId = '';
        let referrerData: AppUserType | null = null;
        referrerSnapshot.forEach(childSnapshot => {
            referrerId = childSnapshot.key!;
            referrerData = childSnapshot.val() as AppUserType;
        });

        if (!referrerId || !referrerData || referrerId === firebaseUser.uid) {
            toast({ title: "Invalid Code", description: "Referral code is invalid or belongs to you.", variant: "destructive" });
            setIsApplyingReferral(false);
            return;
        }

        const currentUserRef = ref(database, `users/${firebaseUser.uid}`);
        const referrerUserRef = ref(database, `users/${referrerId}`);

        let refereeApplied = false;
        await runTransaction(currentUserRef, (currentRefereeData: AppUserType | null) => {
            if (currentRefereeData) {
                if (currentRefereeData.appliedReferralCode) {
                    refereeApplied = true; return;
                }
                currentRefereeData.wallet = (currentRefereeData.wallet || 0) + bonusAmount;
                currentRefereeData.referralBonusReceived = (currentRefereeData.referralBonusReceived || 0) + bonusAmount;
                currentRefereeData.appliedReferralCode = friendCode;
            }
            return currentRefereeData;
        });
        if (refereeApplied) {
          toast({ title: "Referral Error", description: "You have already applied a referral code.", variant: "destructive"});
          setIsApplyingReferral(false);
          return;
        }
        const refereeTxRef = ref(database, `walletTransactions/${firebaseUser.uid}`);
        await push(refereeTxRef, {
            type: 'referral_bonus_received', amount: bonusAmount, status: 'completed',
            date: new Date().toISOString(), description: `Referral bonus from ${referrerData.username || 'referrer'}`,
        });

        await runTransaction(referrerUserRef, (currentReferrerData: AppUserType | null) => {
            if (currentReferrerData) {
                currentReferrerData.wallet = (currentReferrerData.wallet || 0) + bonusAmount;
                currentReferrerData.totalReferralCommissionsEarned = (currentReferrerData.totalReferralCommissionsEarned || 0) + bonusAmount;
            }
            return currentReferrerData;
        });
        const referrerTxRef = ref(database, `walletTransactions/${referrerId}`);
        await push(referrerTxRef, {
            type: 'referral_commission_earned', amount: bonusAmount, status: 'completed',
            date: new Date().toISOString(), description: `Referral commission for ${appUser.username}`,
        });

        toast({ title: "Referral Applied!", description: `You and ${referrerData.username} both received Rs ${bonusAmount}!`, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
        await fetchUserData(firebaseUser); 
        setFriendReferralCodeInput('');

    } catch (error) {
        console.error("Error applying referral code:", error);
        toast({ title: "Referral Error", description: "Could not apply referral code. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
        setIsApplyingReferral(false);
    }
  };

  const handleShareApp = async () => {
    if (!appUser || !appUser.referralCode || !globalSettings?.shareLinkBaseUrl) {
        toast({ title: "Error", description: "Referral code or share link not available.", variant: "destructive"});
        return;
    }
    const shareUrl = `${globalSettings.shareLinkBaseUrl}?ref=${appUser.referralCode}`;
    const shareData = {
      title: 'ComBatZon - Join the Battle!',
      text: `Join me on ComBatZon for exciting eSports tournaments! Use my referral code: ${appUser.referralCode} to get a bonus! ${shareUrl}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({ title: "Shared!", description: "Thanks for sharing ComBatZon!" });
      } else {
        await navigator.clipboard.writeText(shareData.text);
        toast({ title: "Link Copied!", description: "Referral message copied to clipboard." });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Share action cancelled by user.');
      } else {
        toast({ title: "Share Failed", description: "Could not share at this moment. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
      }
    }
  };
  
  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      window.location.assign('/auth/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        title: "Logout Failed",
        description: "Could not log you out completely. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
        <p className="mt-4 text-lg text-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You need to be logged in to view your profile.</p>
        <Button variant="default" className="neon-accent-bg" asChild>
          <Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" />Login</Link>
        </Button>
      </div>
    );
  }

  if (!appUser) {
     return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Profile Data Not Found</h1>
        <p className="text-muted-foreground mb-6">We couldn't retrieve your profile details. If you just signed up, please try again in a moment or contact support if the issue persists.</p>
         <Button variant="outline" asChild>
            <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  const displayUser = isEditing ? formData : appUser;
  const actualProfile = appUser; 

  const socialLinksToDisplay = globalSettings ? [
    { key: 'whatsapp', url: globalSettings.contactWhatsapp, label: 'WhatsApp', Icon: socialIconMap.whatsapp },
    { key: 'email', url: globalSettings.contactEmail, label: 'Email', Icon: socialIconMap.email },
    { key: 'facebook', url: globalSettings.socialMediaFacebook, label: 'Facebook', Icon: socialIconMap.facebook },
    { key: 'instagram', url: globalSettings.socialMediaInstagram, label: 'Instagram', Icon: socialIconMap.instagram },
    { key: 'youtube', url: globalSettings.socialMediaYoutube, label: 'YouTube', Icon: socialIconMap.youtube },
  ].filter(link => link.url && link.Icon && typeof link.url === 'string' && link.url.trim() !== '') : [];

  const isShareAndEarnFeatureActive = globalSettings?.shareAndEarnEnabled && (globalSettings?.referralBonusAmount || 0) > 0;

  let adminPanelLink = '/admin/dashboard';
  let canAccessAdminPanel = false;
  if (appUser.role === 'admin') {
      canAccessAdminPanel = true;
  } else if (appUser.role === 'delegate') {
      const permissions = appUser.delegatePermissions?.accessScreens || {};
      const accessibleScreens = adminNavItems.filter(item => item.permissionKey && permissions[item.permissionKey]);
      if (accessibleScreens.length > 0) {
          canAccessAdminPanel = true;
          if (permissions.dashboard) {
              adminPanelLink = '/admin/dashboard';
          } else {
              adminPanelLink = accessibleScreens[0].href;
          }
      }
  }

  return (
    <div className="space-y-8 pt-8">
      <div className="grid md:grid-cols-3 gap-8">
        <motion.div 
            className="md:col-span-1 space-y-6"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <GlassCard className="p-6 text-center border-2 border-accent/30 shadow-accent/10 shadow-lg relative overflow-hidden">
             <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/20 to-transparent"></div>
            <div className="relative group w-36 h-36 mx-auto mb-4">
              <Avatar className="h-full w-full border-4 border-accent shadow-lg shadow-accent/20">
                  <AvatarImage src={actualProfile.avatarUrl || undefined} alt={actualProfile.username} data-ai-hint="user avatar" />
                  <AvatarFallback className="text-6xl">{actualProfile.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <p className="text-xl font-bold text-foreground mb-1">{actualProfile.username}</p>
            <h2 className="text-3xl font-bold text-foreground neon-accent-text mb-1 flex items-center justify-center">
              <RupeeIcon className="mr-1 h-7 w-auto -mt-0.5" /> {(actualProfile.wallet ?? 0).toFixed(2)}
            </h2>
            <p className="text-muted-foreground text-sm mb-4 flex items-center justify-center">
                <Gift className="mr-1.5 h-4 w-4 text-yellow-400" /> Online Streak: {actualProfile.onlineStreak || 0} days
            </p>
          </GlassCard>

          {canAccessAdminPanel && (
            <GlassCard className="p-6 text-center border-2 border-accent/30 shadow-accent/10 shadow-lg mt-6">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center justify-center">
                    <Shield className="mr-2 h-5 w-5 text-accent" /> Admin Panel
                </h3>
                <Button asChild className="w-full neon-accent-bg">
                    <Link href={adminPanelLink}>
                        Go to Admin Panel
                    </Link>
                </Button>
            </GlassCard>
          )}
          
          {actualProfile.role !== 'admin' && (
            isShareAndEarnFeatureActive && actualProfile.referralCode ? (
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                  <Share2 className="mr-2 h-5 w-5 text-accent" /> Share &amp; Earn
                </h3>
                <p className="text-muted-foreground text-xs mb-1">
                  Your Referral Code:
                </p>
                <div className="flex items-center space-x-2 p-2 bg-input/50 rounded-md border border-border/70 mb-3 shadow-inner">
                  <Input
                    id="referralCodeDisplay"
                    value={actualProfile.referralCode}
                    readOnly
                    className="text-md font-mono tracking-wider border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 select-all flex-grow h-auto py-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(actualProfile.referralCode || '');
                      toast({ title: "Copied!", description: "Referral code copied to clipboard.", className: "bg-green-500/20 text-green-300 border-green-500/30" });
                    }}
                    className="text-accent hover:text-accent/80 h-8 w-8"
                    title="Copy Code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleShareApp} className="w-full neon-accent-bg mb-3">
                  <Share2 className="mr-2 h-4 w-4" /> Share App Link
                </Button>
                {(actualProfile.referralBonusReceived ?? 0) > 0 && (
                  <p className="text-xs text-green-400 mt-2 text-center">Bonus Received: <RupeeIcon className="inline h-3 w-auto -mt-0.5" /> {actualProfile.referralBonusReceived}</p>
                )}
                {(actualProfile.totalReferralCommissionsEarned ?? 0) > 0 && (
                  <p className="text-xs text-green-400 mt-1 text-center">Total Commissions: <RupeeIcon className="inline h-3 w-auto -mt-0.5" /> {actualProfile.totalReferralCommissionsEarned}</p>
                )}
              </GlassCard>
            ) : null
          )}

          {!isLoadingSettings && socialLinksToDisplay.length > 0 && actualProfile.role !== 'admin' && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Globe className="mr-2 h-5 w-5 text-accent" /> Connect With Us
              </h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {socialLinksToDisplay.map(link => {
                  const IconComponent = link.Icon;
                  let correctedUrl = link.url!;
                  if (link.key === 'email' && !correctedUrl.startsWith('mailto:')) {
                    correctedUrl = `mailto:${correctedUrl}`;
                  } else if (link.key !== 'email' && !correctedUrl.startsWith('http://') && !correctedUrl.startsWith('https://')) {
                    correctedUrl = `https://${correctedUrl}`;
                  }
                  return (
                    <Button key={link.key} variant="outline" size="icon" className="h-10 w-10 border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground rounded-full" asChild>
                      <a href={correctedUrl} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                        <IconComponent className="h-5 w-5" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </motion.div>

        <motion.div 
            className="md:col-span-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
        >
          <GlassCard className="p-6 md:p-8 space-y-8">
            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-foreground flex items-center">
                  <UserCircle className="mr-3 h-6 w-6 text-accent" /> Account Information
                </h3>
                {!isEditing && (
                  <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80" onClick={handleEditToggle}>
                    <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
                  </Button>
                )}
              </div>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</Label>
                    <Input id="username" name="username" value={displayUser.username || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className={cn("mt-1 bg-input/30 border-border/50 read-only:opacity-70 read-only:cursor-not-allowed", isEditing && validationErrors.username && 'border-destructive focus:border-destructive')} />
                    {isEditing && validationErrors.username && (
                      <p className="text-destructive text-xs mt-1">{validationErrors.username}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
                    <Input id="email" name="email" type="email" value={displayUser.email || ''} readOnly disabled className="mt-1 bg-input/30 border-border/50 opacity-70 cursor-not-allowed"/>
                  </div>
                </div>
                 <div>
                  <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                  <Input id="phone" name="phone" type="tel" value={displayUser.phone || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className={cn("mt-1 bg-input/30 border-border/50 read-only:opacity-70 read-only:cursor-not-allowed", isEditing && validationErrors.phone && 'border-destructive focus:border-destructive')}/>
                  {isEditing && validationErrors.phone && (
                    <p className="text-destructive text-xs mt-1">{validationErrors.phone}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="gameName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In-Game Name (IGN)</Label>
                  <Input id="gameName" name="gameName" value={displayUser.gameName || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className={cn("mt-1 bg-input/30 border-border/50 read-only:opacity-70 read-only:cursor-not-allowed", isEditing && validationErrors.gameName && 'border-destructive focus:border-destructive')}/>
                   {isEditing && validationErrors.gameName && (
                    <p className="text-destructive text-xs mt-1">{validationErrors.gameName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="gameUid" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In-Game UID</Label>
                  <Input id="gameUid" name="gameUid" value={displayUser.gameUid || ''} onChange={handleInputChange} readOnly={!isEditing} disabled={isSaving} className={cn("mt-1 bg-input/30 border-border/50 read-only:opacity-70 read-only:cursor-not-allowed", isEditing && validationErrors.gameUid && 'border-destructive focus:border-destructive')}/>
                   {isEditing && validationErrors.gameUid && (
                    <p className="text-destructive text-xs mt-1">{validationErrors.gameUid}</p>
                  )}
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={handleEditToggle} disabled={isSaving} className="border-muted-foreground text-muted-foreground hover:bg-muted/20">
                      <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button type="button" onClick={handleSaveChanges} className="neon-accent-bg" disabled={isSaving || Object.keys(validationErrors).length > 0}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </section>

            <Separator className="bg-border/50" />

            <section>
              <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                <KeyRound className="mr-3 h-6 w-6 text-accent"/>Change Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-6">
                  <div>
                    <Label htmlFor="currentPassword"  className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Password</Label>
                    <Input id="currentPassword" type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 bg-input/30 border-border/50 focus:border-accent"/>
                  </div>
                  <div>
                    <Label htmlFor="newPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</Label>
                    <Input id="newPassword" type="password" placeholder="Min. 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 bg-input/30 border-border/50 focus:border-accent"/>
                  </div>
                  <div>
                    <Label htmlFor="confirmNewPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm New Password</Label>
                    <Input id="confirmNewPassword" type="password" placeholder="Re-type new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-1 bg-input/30 border-border/50 focus:border-accent"/>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button type="submit" className="neon-accent-bg" disabled={isPasswordUpdating}>
                      {isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </div>
              </form>
            </section>
            
            <Separator className="bg-border/50" />

            <section className="text-center">
                 <Button variant="destructive" onClick={handleLogout} className="w-full max-w-sm mx-auto">
                    <LogOutIcon className="mr-2 h-5 w-5"/> Log Out
                </Button>
            </section>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
