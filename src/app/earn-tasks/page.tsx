
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue, get, off } from 'firebase/database';
import type { GlobalSettings, ClickAndEarnLink, YouTubePromotionSettings, User } from '@/types';

import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Coins, ExternalLink, Handshake, Gift, Youtube, Video, Loader2, Cpu, ListChecks, Wand2, Tv, Award, HelpCircle, Sparkles } from 'lucide-react';
import Image from 'next/image';

import { trackTaskClick } from './actions';
import YoutubePromotionTask from '@/components/youtube/YoutubePromotionTask';
import ClickAndEarnList from '@/components/youtube/ClickAndEarnList';
import { getYoutubeVideoId, getDisplayableBannerUrl } from '@/lib/image-helper';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getClickAndEarnExplanation } from '@/ai/flows/mining-explanation-flow';


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
    const [clickAndEarnLinks, setClickAndEarnLinks] = useState<ClickAndEarnLink[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);

    const handleGetExplanation = async () => {
        setIsGeneratingExplanation(true);
        setExplanation(null);
        try {
            const result = await getClickAndEarnExplanation({
                pointsToCurrencyRate: globalSettings.pointsToCurrencyRate || 50,
                currencyPerRate: globalSettings.currencyPerRate || 49.5,
                dailyPointsLimit: globalSettings.dailyPointsLimit || 100
            });
            setExplanation(result.explanation);
        } catch (error) {
            console.error("Failed to get AI explanation", error);
            setExplanation("Sorry, I couldn't get the explanation right now. Please try again.");
        } finally {
            setIsGeneratingExplanation(false);
        }
    };

    useEffect(() => {
        if (!database) {
            setIsLoadingData(false);
            return;
        }

        const settingsRef = ref(database, 'globalSettings');
        const settingsListener = onValue(settingsRef, (snapshot) => {
            setGlobalSettings(snapshot.exists() ? snapshot.val() : {});
        });

        const linksRef = ref(database, 'clickAndEarnLinks');
        const linksListener = onValue(linksRef, (snapshot) => {
            const data = snapshot.val();
            setClickAndEarnLinks(data ? Object.keys(data).map(id => ({ id, ...data[id] })) : []);
        });

        Promise.all([get(settingsRef), get(linksRef)]).finally(() => {
            setIsLoadingData(false);
        });

        return () => {
            off(settingsRef, 'value', settingsListener);
            off(linksRef, 'value', linksListener);
        };
    }, []);

    const youtubePromotionSettings = globalSettings?.youtubePromotionSettings;
    const feyorraTaskEnabled = globalSettings?.feyorraTaskEnabled;
    const rollerCoinTaskEnabled = globalSettings?.rollerCoinTaskEnabled;
    const timebucksTaskSettings = globalSettings?.timebucksTaskSettings;
    const customTaskCardSettings = globalSettings?.customTaskCardSettings;
    const feyorraReferralUrl = globalSettings?.feyorraReferralUrl;
    const rollerCoinReferralUrl = globalSettings?.rollerCoinReferralUrl;
    
    const clickAndEarnTitle = globalSettings?.clickAndEarnTitle || "Turn Your Clicks into Cash!";
    const clickAndEarnDescription = globalSettings?.clickAndEarnDescription || "Watch ads, complete simple tasks, and see your points stack up. Every click brings you closer to your next reward.";

    const isLoading = authLoading || isLoadingData;
    
    const showYoutubeTask = youtubePromotionSettings?.enabled && !user?.youtubeSubscriptionAwarded;
    const showLiveStream = youtubePromotionSettings?.liveStreamEnabled && youtubePromotionSettings?.liveStreamUrl;


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-accent"/>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto py-8">
            <PageTitle
                title="Earn Rewards"
                subtitle="Complete tasks, subscribe, and watch ads to earn points."
            />
            <div className="space-y-8">
                {showLiveStream && <LiveStreamSection settings={youtubePromotionSettings!} />}

                {showYoutubeTask && (
                    <GlassCard className="p-4 md:p-6">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                           <Youtube className="h-7 w-7 text-red-500" /> YouTube Subscription Task
                        </h3>
                        <YoutubePromotionTask settings={youtubePromotionSettings} />
                    </GlassCard>
                )}
                
                {timebucksTaskSettings?.enabled && timebucksTaskSettings.referralUrl && (
                    <GlassCard className="text-center p-6 md:p-8 space-y-6">
                        <ListChecks className="h-12 w-12 text-green-400 mx-auto" />
                        <h3 className="text-xl md:text-2xl font-bold text-foreground">Get Paid for Your Time</h3>
                        <p className="text-muted-foreground text-base max-w-md mx-auto">
                            TimeBucks is a popular platform where you can earn real cash by completing surveys, watching videos, installing apps, and doing other simple tasks.
                        </p>
                        <Alert variant="default" className="bg-green-500/10 border-green-500/30 text-left">
                            <Handshake className="h-5 w-5 !text-green-400" />
                            <AlertTitle className="!text-green-300">Daily Bonuses</AlertTitle>
                            <AlertDescription className="!text-green-400/80 text-sm">
                            Get rewarded for your activity with daily bonuses and a reliable payout system. Sign up for free and start earning today.
                            </AlertDescription>
                        </Alert>
                        <Button
                            onClick={() => {
                                const userId = user?.id || 'anonymous';
                                trackTaskClick(userId, 'timebucks');
                                window.open(timebucksTaskSettings.referralUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105"
                        >
                            <ExternalLink className="mr-2 h-5 w-5"/> Start Earning on TimeBucks
                        </Button>
                    </GlassCard>
                )}

                {rollerCoinTaskEnabled && rollerCoinReferralUrl && (
                    <GlassCard className="text-center p-6 md:p-8 space-y-6">
                        <Cpu className="h-12 w-12 text-accent mx-auto" />
                        <h3 className="text-xl md:text-2xl font-bold text-foreground">Play Games, Earn Real Crypto</h3>
                        <p className="text-muted-foreground text-base max-w-md mx-auto">
                            No need to invest or buy mining rigs. Just play simple arcade games on RollerCoin and start earning real cryptocurrency like Bitcoin, Dogecoin, and more, right from your phone or PC.
                        </p>
                        <Alert variant="default" className="bg-primary/10 border-primary/30 text-left">
                            <Handshake className="h-5 w-5 !text-primary" />
                            <AlertTitle className="!text-primary">100% Free & Safe</AlertTitle>
                            <AlertDescription className="!text-primary/80 text-sm">
                            No downloads, no risk! Join through our partner link to start your crypto journey today.
                            </AlertDescription>
                        </Alert>
                        <Button
                            onClick={() => {
                                const userId = user?.id || 'anonymous';
                                trackTaskClick(userId, 'rollercoin');
                                window.open(rollerCoinReferralUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105"
                        >
                            <ExternalLink className="mr-2 h-5 w-5"/> Start Mining with Games
                        </Button>
                    </GlassCard>
                )}
                
                {feyorraTaskEnabled && feyorraReferralUrl && (
                    <GlassCard className="text-center p-6 md:p-8 space-y-6">
                        <Image src={getDisplayableBannerUrl(globalSettings.feyorraLogoUrl, "Feyorra Tasks")} alt="Feyorra Tasks Logo" width={200} height={50} className="h-12 object-contain mx-auto" data-ai-hint="tasks logo" />
                        <h3 className="text-xl md:text-2xl font-bold text-foreground">Complete Partner Tasks</h3>
                        <Alert variant="default" className="bg-primary/10 border-primary/30 text-left">
                            <Handshake className="h-5 w-5 !text-primary" />
                            <AlertTitle className="!text-primary">External Partner Tasks</AlertTitle>
                            <AlertDescription className="!text-primary/80 text-sm space-y-2">
                            <p>Earnings from these tasks are paid directly to the partner platform's wallet, not your in-app wallet. You must manage your rewards there.</p>
                            </AlertDescription>
                        </Alert>
                        <p className="text-muted-foreground text-base max-w-md mx-auto">
                           Complete a variety of tasks from our partner Feyorra and get paid directly to their platform.
                        </p>
                        <Button
                            onClick={() => {
                                const userId = user?.id || 'anonymous';
                                trackTaskClick(userId, 'feyorra');
                                window.open(feyorraReferralUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="w-full max-w-sm text-md md:text-lg py-4 md:py-6 neon-accent-bg rounded-lg shadow-lg hover:shadow-accent/50 transition-all duration-300 transform hover:scale-105"
                        >
                            <ExternalLink className="mr-2 h-5 w-5"/> Start Earning
                        </Button>
                    </GlassCard>
                )}
                
                {customTaskCardSettings?.enabled && (
                    <>
                        <Separator/>
                        <CustomTaskCard user={user} settings={customTaskCardSettings} />
                    </>
                )}


                <Separator/>

                {(clickAndEarnLinks?.length ?? 0) > 0 && (
                    <GlassCard className="p-4 md:p-6 text-center">
                         <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                           <Gift className="h-7 w-7 text-yellow-400" /> Click &amp; Earn
                        </h3>
                        <Alert variant="default" className="my-6 bg-accent/20 border-accent/50 text-left">
                            <AlertTitle className="text-accent font-bold flex items-center">
                                <Coins className="mr-2 h-5 w-5"/> {clickAndEarnTitle}
                            </AlertTitle>
                            <AlertDescription className="text-accent/90">
                                {clickAndEarnDescription}
                            </AlertDescription>
                        </Alert>
                        <ClickAndEarnList links={clickAndEarnLinks} user={user} settings={globalSettings} />

                        <div className="mt-8 border-t border-border/50 pt-6">
                            <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center justify-center gap-2">
                                <HelpCircle className="h-5 w-5 text-accent"/>
                                Need Help?
                            </h4>
                            <Button onClick={handleGetExplanation} disabled={isGeneratingExplanation}>
                                {isGeneratingExplanation ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                ) : (
                                    <Sparkles className="mr-2 h-4 w-4"/>
                                )}
                                Ask AI: How does this work?
                            </Button>
                            {explanation && (
                                <Alert className="mt-4 text-left whitespace-pre-line bg-background/50 border-accent/30">
                                    <Sparkles className="h-4 w-4 text-accent" />
                                    <AlertTitle className="font-bold text-accent">AI Assistant</AlertTitle>
                                    <AlertDescription>
                                        {explanation}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                    </GlassCard>
                )}
            </div>
        </div>
    );
}
