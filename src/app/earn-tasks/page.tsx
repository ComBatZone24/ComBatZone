

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import type { GlobalSettings, ClickAndEarnLink, YouTubePromotionSettings, User, WalletTransaction, ClickMilestone, CpaGripSettings } from '@/types';

import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Coins, ExternalLink, Gift, Youtube, Video, Loader2, ListChecks, Wand2, Tv, Info, HelpCircle, Lock } from 'lucide-react';
import Image from 'next/image';

import { trackTaskClick } from './actions';
import YoutubePromotionTask from '@/components/youtube/YoutubePromotionTask';
import { getYoutubeVideoId, getDisplayableBannerUrl } from '@/lib/image-helper';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getClickAndEarnExplanation } from '@/ai/flows/mining-explanation-flow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClickAndEarnComponent from '@/components/youtube/ClickAndEarnList';


const FeyorraTaskCard = ({ user, feyorraReferralUrl, feyorraLogoUrl }: { user: any, feyorraReferralUrl: string, feyorraLogoUrl: string}) => {
    const handleStartTask = useCallback(() => {
        const userId = user?.id || 'anonymous';
        trackTaskClick(userId, 'feyorra_task');
        window.open(feyorraReferralUrl, '_blank', 'noopener,noreferrer');
    }, [user, feyorraReferralUrl]);

    return (
        <GlassCard className="text-center p-6 md:p-8 space-y-6">
            {feyorraLogoUrl && <Image src={getDisplayableBannerUrl(feyorraLogoUrl)} alt="Feyorra Logo" width={200} height={100} className="h-24 object-contain mx-auto" data-ai-hint="feyorra logo" />}
            <h3 className="text-xl md:text-2xl font-bold text-foreground">Earn Crypto with Feyorra</h3>
            <p className="text-muted-foreground text-base max-w-md mx-auto">Complete tasks on the Feyorra platform and get rewarded with cryptocurrency. An easy way to top up your crypto balance.</p>
            <Button
                onClick={handleStartTask}
                className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105"
            >
                <ExternalLink className="mr-2 h-5 w-5"/> Start Feyorra Tasks
            </Button>
        </GlassCard>
    );
};


const CustomTaskCard = ({ user, settings }: { user: any, settings: NonNullable<GlobalSettings['customTaskCardSettings']> }) => {
    const handleStartTask = useCallback(() => {
        const userId = user?.id || 'anonymous';
        trackTaskClick(userId, 'custom_task');
        window.open(settings.buttonLink, '_blank', 'noopener,noreferrer');
    }, [user, settings.buttonLink]);

    return (
        <GlassCard className="text-center p-6 md:p-8 space-y-6">
            {settings.imageUrl && <Image src={getDisplayableBannerUrl(settings.imageUrl)} alt={settings.title} width={200} height={100} className="h-24 object-contain mx-auto" data-ai-hint="custom task banner"/>}
            <h3 className="text-xl md:text-2xl font-bold text-foreground">{settings.title}</h3>
            <p className="text-muted-foreground text-base max-w-md mx-auto">{settings.description}</p>
            <Button
                onClick={handleStartTask}
                className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105"
            >
                <ExternalLink className="mr-2 h-5 w-5"/> {settings.buttonText || 'Start Now'}
            </Button>
        </GlassCard>
    );
};

const CpaGripTaskCard = ({ user, settings }: { user: User, settings: CpaGripSettings }) => {
  const [availableUrls, setAvailableUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const completedOffers = user.completedCpaOffers || {};
    const uncompleted = settings.offerUrls?.filter(url => !completedOffers[btoa(url)]) || [];
    setAvailableUrls(uncompleted);
    setIsLoading(false);
  }, [user.completedCpaOffers, settings.offerUrls]);
  
  const handleStartTask = useCallback(() => {
    if (availableUrls.length === 0 || !settings.postbackKey) return;
    
    const randomUrl = availableUrls[Math.floor(Math.random() * availableUrls.length)];
    const encodedUrlId = btoa(randomUrl); // Base64 encode the URL to use as a unique ID

    const trackingUrl = `${randomUrl}&sub1=${user.id}&sub2=${settings.postbackKey}&offer_url_id=${encodedUrlId}`;

    trackTaskClick(user.id, 'cpagrip_task');
    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
  }, [user, settings, availableUrls]);
  
  if (isLoading) {
    return <GlassCard className="flex items-center justify-center p-6 h-64"><Loader2 className="animate-spin h-8 w-8 text-accent"/></GlassCard>;
  }

  if (availableUrls.length === 0) {
    // Optionally return null or a "no offers" message
    return null;
  }

  return (
    <GlassCard className="text-center p-6 md:p-8 space-y-6 border-2 border-green-500/30 shadow-green-500/10 shadow-lg">
      <Lock className="mx-auto h-12 w-12 text-green-400" />
      <h3 className="text-xl md:text-2xl font-bold text-green-300">{settings.title}</h3>
      <p className="text-muted-foreground text-base max-w-md mx-auto">{settings.description}</p>
       <p className="font-bold text-lg text-yellow-400">Reward: {settings.points} PKR</p>
      <Button
        onClick={handleStartTask}
        className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg hover:shadow-green-600/50 transition-all duration-300 transform hover:scale-105"
      >
        <ExternalLink className="mr-2 h-5 w-5"/> Start Offer
      </Button>
    </GlassCard>
  );
};

const LiveStreamSection = ({ settings }: { settings: YouTubePromotionSettings }) => {
    const videoId = getYoutubeVideoId(settings.liveStreamUrl);

    if (!videoId) return null;

    return (
        <GlassCard className="p-4 md:p-6">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <div className="relative flex h-5 w-5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <Tv className="h-5 w-5 text-red-500" />
                </div>
                Live Stream
            </h3>
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-border/50">
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&autohide=1&modestbranding=1`}
                    frameBorder="0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title="Live Stream"
                ></iframe>
            </div>
        </GlassCard>
    );
};

export default function EarnTasksPage() {
    const { user, loading: authLoading } = useAuth();
    const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    
    const [isExplanationOpen, setIsExplanationOpen] = useState(false);
    const [explanation, setExplanation] = useState<string>('');
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

    useEffect(() => {
        if (!database) {
            setIsLoadingSettings(false);
            return;
        }
        const settingsRef = ref(database, 'globalSettings');

        const settingsListener = onValue(settingsRef, (snapshot) => {
            setGlobalSettings(snapshot.exists() ? snapshot.val() : {});
            setIsLoadingSettings(false);
        });

        return () => {
            off(settingsRef, 'value', settingsListener);
        };
    }, []);

    const handleGetExplanation = async () => {
        const milestone = globalSettings.clickMilestones?.find(m => m.clicks === 98);
        if (!globalSettings.pkrPerPoint || !milestone) return;
        
        setIsExplanationOpen(true);
        setIsLoadingExplanation(true);
        try {
            const result = await getClickAndEarnExplanation({
                pkrPerPoint: globalSettings.pkrPerPoint,
                dailyTarget: 98,
                dailyReward: milestone.points,
            });
            setExplanation(result.explanation);
        } catch (error) {
            console.error(error);
            setExplanation("Sorry, I couldn't generate an explanation right now. Please try again later.");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const youtubePromotionSettings = globalSettings?.youtubePromotionSettings;
    const timebucksTaskSettings = globalSettings?.timebucksTaskSettings;
    const customTaskCardSettings = globalSettings?.customTaskCardSettings;
    const cpaGripSettings = globalSettings?.cpaGripSettings;
    
    const isLoading = authLoading || isLoadingSettings;
    
    const fallbackSettings = {
        clickAndEarnTitle: 'Earn Rewards',
        clickAndEarnDescription: "Complete tasks, subscribe, and watch ads to earn points."
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-accent"/>
            </div>
        );
    }
    
    const showYoutubeTask = youtubePromotionSettings?.enabled && !user?.youtubeSubscriptionAwarded;
    const showLiveStream = youtubePromotionSettings?.liveStreamEnabled && youtubePromotionSettings?.liveStreamUrl;
    const showClickAndEarn = globalSettings?.clickAndEarnEnabled && user;
    
    return (
        <div className="container mx-auto py-8">
            <PageTitle
                title={globalSettings.clickAndEarnTitle || fallbackSettings.clickAndEarnTitle}
                subtitle={globalSettings.clickAndEarnDescription || fallbackSettings.clickAndEarnDescription}
            />
            <div className="space-y-8">
                {showLiveStream && <LiveStreamSection settings={youtubePromotionSettings!} />}
                
                {showClickAndEarn && (
                    <>
                        <ClickAndEarnComponent user={user} settings={globalSettings} />
                        <div className="text-center">
                            <Button variant="link" onClick={handleGetExplanation} className="text-accent hover:text-accent/80">
                                <HelpCircle className="mr-2 h-4 w-4" /> Need Help?
                            </Button>
                        </div>
                    </>
                )}

                {showYoutubeTask && (
                    <GlassCard className="p-4 md:p-6">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                           <Youtube className="h-7 w-7 text-red-500" /> YouTube Subscription Task
                        </h3>
                        <YoutubePromotionTask settings={youtubePromotionSettings} />
                    </GlassCard>
                )}

                {user && cpaGripSettings?.enabled && (
                    <>
                        <Separator />
                        <CpaGripTaskCard user={user} settings={cpaGripSettings} />
                    </>
                )}
                
                {globalSettings?.feyorraTaskEnabled && globalSettings.feyorraReferralUrl && (
                    <>
                      <Separator/>
                      <FeyorraTaskCard user={user} feyorraReferralUrl={globalSettings.feyorraReferralUrl} feyorraLogoUrl={globalSettings.feyorraLogoUrl || ''} />
                    </>
                )}

                {timebucksTaskSettings?.enabled && timebucksTaskSettings.referralUrl && (
                    <CustomTaskCard user={user} settings={timebucksTaskSettings as any} />
                )}

                {customTaskCardSettings?.enabled && (
                    <>
                        <Separator/>
                        <CustomTaskCard user={user} settings={customTaskCardSettings} />
                    </>
                )}
            </div>

            <Dialog open={isExplanationOpen} onOpenChange={setIsExplanationOpen}>
                <DialogContent className="glass-card sm:max-w-lg">
                    <DialogHeader>
                         <DialogTitle className="flex items-center gap-2"><Info className="text-accent"/> How It Works</DialogTitle>
                         <DialogDescription>Your guide to the Click &amp; Earn feature.</DialogDescription>
                    </DialogHeader>
                    <div className="prose prose-invert prose-sm text-foreground max-h-[60vh] overflow-y-auto py-4">
                        {isLoadingExplanation ? (
                            <div className="flex items-center justify-center"><Loader2 className="animate-spin h-6 w-6"/></div>
                        ) : (
                            <p className="whitespace-pre-line">{explanation}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
