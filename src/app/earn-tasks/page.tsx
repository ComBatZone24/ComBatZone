
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import type { GlobalSettings } from '@/types';

import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Youtube, Loader2, ListChecks, Wand2, Tv, Link as LinkIcon, Cpu } from 'lucide-react';
import Image from 'next/image';

import { trackTaskClick } from './actions';
import YoutubePromotionTask from '@/components/youtube/YoutubePromotionTask';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import { Separator } from '@/components/ui/separator';
import ClickAndEarnComponent from '@/components/youtube/ClickAndEarnList';

const FeyorraTaskCard = ({ user, feyorraReferralUrl, feyorraLogoUrl }: { user: any, feyorraReferralUrl: string, feyorraLogoUrl: string}) => {
    const handleStartTask = () => {
        const userId = user?.id || 'anonymous';
        trackTaskClick(userId, 'feyorra_task');
        window.open(feyorraReferralUrl, '_blank', 'noopener,noreferrer');
    };

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
    const handleStartTask = () => {
        const userId = user?.id || 'anonymous';
        trackTaskClick(userId, 'custom_task');
        window.open(settings.buttonLink, '_blank', 'noopener,noreferrer');
    };

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

const LiveStreamSection = ({ settings }: { settings: NonNullable<GlobalSettings['youtubePromotionSettings']> }) => {
    const videoId = settings.liveStreamUrl ? new URL(settings.liveStreamUrl).searchParams.get('v') : null;
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

const CpuMiningCard = () => {
    const handleStartMining = () => {
        window.open('/mintme-miner.html', '_blank', 'noopener,noreferrer,width=400,height=600');
    };
    return (
        <GlassCard className="text-center p-6 md:p-8 space-y-6">
            <Cpu className="mx-auto h-16 w-16 text-accent" />
            <h3 className="text-xl md:text-2xl font-bold text-foreground">CPU Mining (MINTME)</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Use your device's spare processing power to earn MINTME coins. Ideal for when your device is idle or charging.
            </p>
             <Button
                onClick={handleStartMining}
                className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105"
            >
                <Cpu className="mr-2 h-5 w-5"/> Start Mining
            </Button>
        </GlassCard>
    );
};

export default function EarnTasksPage() {
    const { user, loading: authLoading } = useAuth();
    const [globalSettings, setGlobalSettings] = useState<Partial<GlobalSettings>>({});
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!database) {
            setIsLoading(false);
            return;
        }

        const settingsRef = ref(database, 'globalSettings');
        const settingsListener = onValue(settingsRef, (snapshot) => {
            setGlobalSettings(snapshot.exists() ? snapshot.val() : {});
            setIsLoading(false);
        });

        return () => {
            off(settingsRef, 'value', settingsListener);
        };
    }, []);

    const youtubePromotionSettings = globalSettings?.youtubePromotionSettings;
    const timebucksTaskSettings = globalSettings?.timebucksTaskSettings;
    const customTaskCardSettings = globalSettings?.customTaskCardSettings;
    
    if (authLoading || isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-accent"/>
            </div>
        );
    }
    
    const showYoutubeTask = youtubePromotionSettings?.enabled && user && !user.youtubeSubscriptionAwarded;
    const showLiveStream = youtubePromotionSettings?.liveStreamEnabled && youtubePromotionSettings?.liveStreamUrl;
    
    const fallbackSettings = {
        clickAndEarnTitle: 'Earn Rewards',
        clickAndEarnDescription: "Complete tasks, subscribe, and watch ads to earn points."
    };
    
    return (
        <div className="container mx-auto py-8">
            <PageTitle
                title={globalSettings.clickAndEarnTitle || fallbackSettings.clickAndEarnTitle}
                subtitle={globalSettings.clickAndEarnDescription || fallbackSettings.clickAndEarnDescription}
            />
            <div className="space-y-8">
                {showLiveStream && <LiveStreamSection settings={youtubePromotionSettings!} />}
                
                {globalSettings.clickAndEarnEnabled && user && (
                    <ClickAndEarnComponent user={user} settings={globalSettings} />
                )}

                {showYoutubeTask && (
                    <GlassCard className="p-4 md:p-6">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                           <Youtube className="h-7 w-7 text-red-500" /> YouTube Subscription Task
                        </h3>
                        <YoutubePromotionTask settings={youtubePromotionSettings} />
                    </GlassCard>
                )}

                <Separator />

                <CpuMiningCard />
                
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
        </div>
    );
}
