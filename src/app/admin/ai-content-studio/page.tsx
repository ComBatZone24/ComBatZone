
"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { Wand2, Loader2, Copy, Sparkles, Tags, Type, Image as ImageIcon, FileText, TrendingUp, Search, Clock, Users, BrainCircuit, RefreshCw, Coins, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { generateSocialContent } from '@/ai/flows/generate-social-content-flow';
import type { GenerateSocialContentOutput } from '@/ai/flows/generate-social-content-flow';
import type { TrendingTopic, TrendingTopicsInput, TrendingTopicsOutput } from '@/ai/flows/get-trending-topics-flow';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { getTrendingTopics } from '@/ai/flows/get-trending-topics-flow';


const contentSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters long."),
  platform: z.enum(['TikTok', 'Facebook', 'Google', 'Instagram', 'X (Twitter)']),
});

type ContentFormValues = z.infer<typeof contentSchema>;
type Platform = z.infer<typeof contentSchema.shape.platform.Values> | 'Crypto';

const ResultCard = ({ title, icon: Icon, children, onCopy, hasContent }: { title: string, icon: React.ElementType, children: React.ReactNode, onCopy: () => void, hasContent: boolean }) => (
    <GlassCard className="p-4 bg-card/80 flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
                <Icon className="h-5 w-5 text-accent"/>
                {title}
            </h4>
            {hasContent && (
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-accent" onClick={onCopy} title={`Copy ${title}`}>
                    <Copy className="h-4 w-4"/>
                </Button>
            )}
        </div>
        <div className="text-foreground text-sm bg-background/50 p-3 rounded-md flex-grow min-h-[60px]">
            {children}
        </div>
    </GlassCard>
);

const TrendingTopicsPanel = ({ onTopicSelect }: { onTopicSelect: (topic: string) => void }) => {
    const [trendingTopics, setTrendingTopics] = useState<Record<Platform, TrendingTopic[]>>({} as Record<Platform, TrendingTopic[]>);
    const [isLoadingTrends, setIsLoadingTrends] = useState<Platform | null>(null);
    const [searchTerm, setSearchTerm] = useState<Record<Platform, string>>({} as Record<Platform, string>);
    const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const { toast } = useToast();

    const fetchTrends = useCallback(async (platform: Platform) => {
        setIsLoadingTrends(platform);
        try {
            const result: TrendingTopicsOutput = await getTrendingTopics({ platform: platform as TrendingTopicsInput['platform'] });
            setTrendingTopics(prev => ({ ...prev, [platform]: result.topics }));

        } catch (error: any) {
            console.error(`Error fetching trends for ${platform}:`, error);
            toast({ title: "Error Fetching Trends", description: `Could not load trends for ${platform}. Please try refreshing.`, variant: "destructive" });
        } finally {
            setIsLoadingTrends(null);
        }
    }, [toast]);

    const handleSearchChange = (platform: Platform, value: string) => {
        setSearchTerm(prev => ({ ...prev, [platform]: value }));
    };

    const filteredTopics = (platform: Platform) => {
        const platformTopics = trendingTopics[platform] || [];
        const platformSearchTerm = searchTerm[platform]?.toLowerCase() || '';
        if (!platformSearchTerm) return platformTopics;
        return platformTopics.filter(t => t.topic.toLowerCase().includes(platformSearchTerm) || t.reason.toLowerCase().includes(platformSearchTerm));
    };

    const platforms: Platform[] = ['Google', 'TikTok', 'Instagram', 'Facebook', 'X (Twitter)', 'Crypto'];

    useEffect(() => {
        fetchTrends('Google');
    }, [fetchTrends]);

    const getSignalIcon = (signal: 'PUMP' | 'DUMP' | 'NEUTRAL' | undefined) => {
        switch (signal) {
            case 'PUMP': return <ArrowUp className="h-4 w-4 text-green-400" />;
            case 'DUMP': return <ArrowDown className="h-4 w-4 text-red-400" />;
            default: return <Minus className="h-4 w-4 text-gray-500" />;
        }
    };


    return (
        <GlassCard className="mt-8">
            <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <TrendingUp className="text-accent"/> Trending Now
            </h3>
            <Tabs defaultValue="Google" className="w-full" onValueChange={(value) => fetchTrends(value as Platform)}>
                 <ScrollArea className="w-full whitespace-nowrap rounded-md">
                    <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                        {platforms.map(p => <TabsTrigger key={p} value={p}>{p}</TabsTrigger>)}
                    </TabsList>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                 {platforms.map(p => (
                    <TabsContent key={p} value={p} className="mt-4">
                        <div className="flex gap-2 items-center mb-4">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder={`Search in ${p} trends...`}
                                    className="pl-10"
                                    value={searchTerm[p] || ''}
                                    onChange={(e) => handleSearchChange(p, e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" onClick={() => fetchTrends(p)} disabled={isLoadingTrends === p}>
                                {isLoadingTrends === p ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                            </Button>
                        </div>
                        
                        {isLoadingTrends === p ? (
                             <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-accent"/>
                            </div>
                        ) : (
                             <AnimatePresence>
                                <motion.ul 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1, transition: { staggerChildren: 0.07 } }}
                                    className="space-y-3"
                                >
                                    {filteredTopics(p).length === 0 ? (
                                        <p className="text-center text-muted-foreground py-10">No trending topics found for this platform.</p>
                                    ) : (
                                    filteredTopics(p)?.map((topic, index) => {
                                        const signalColor = topic.signal === 'PUMP' ? 'text-green-400' : topic.signal === 'DUMP' ? 'text-red-400' : 'text-accent';
                                        return (
                                        <motion.li 
                                            key={`${p}-${index}`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="flex items-start gap-3 p-3 bg-background/40 rounded-lg border border-border/30 hover:bg-accent/10 transition-colors cursor-pointer"
                                            onClick={() => { setSelectedTopic(topic); setIsDetailOpen(true); }}
                                        >
                                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted flex-shrink-0">
                                                <span className={cn("text-md font-bold", signalColor)}>{p === 'Crypto' ? getSignalIcon(topic.signal) : index + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">{topic.topic}</p>
                                                <p className="text-xs text-muted-foreground truncate">{topic.reason}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); onTopicSelect(topic.topic); }} title="Use this topic">
                                                <Copy className="h-4 w-4"/>
                                            </Button>
                                        </motion.li>
                                    )})
                                    )}
                                </motion.ul>
                            </AnimatePresence>
                        )}
                    </TabsContent>
                ))}
            </Tabs>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="glass-card sm:max-w-lg">
                    {selectedTopic && (
                        <>
                        <DialogHeader>
                            <DialogTitle className="text-accent text-2xl flex items-center gap-2">
                                {selectedTopic.platform === 'Crypto' && getSignalIcon(selectedTopic.signal)}
                                {selectedTopic.topic}
                            </DialogTitle>
                            <DialogDescription>
                                AI-powered analysis of this trend.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 my-4">
                            <div>
                                <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1"><BrainCircuit className="h-5 w-5 text-accent"/>Why It's Trending</h4>
                                <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">{selectedTopic.reason}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1"><Clock className="h-5 w-5 text-accent"/>Predicted Longevity</h4>
                                <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">{selectedTopic.longevity}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1"><Users className="h-5 w-5 text-accent"/>Target Audience</h4>
                                <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">{selectedTopic.audience}</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                        </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </GlassCard>
    );
};


export default function AiContentStudioPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<GenerateSocialContentOutput | null>(null);

    const form = useForm<ContentFormValues>({
        resolver: zodResolver(contentSchema),
        defaultValues: {
            topic: '',
            platform: 'Facebook',
        }
    });

    const onSubmit = async (data: ContentFormValues) => {
        setIsLoading(true);
        setGeneratedContent(null);
        try {
            const result = await generateSocialContent(data);
            setGeneratedContent(result);
            toast({ title: "Content Generated!", description: "AI has successfully created your content." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string | string[]) => {
        const textToCopy = Array.isArray(text) ? text.join(', ') : text;
        navigator.clipboard.writeText(textToCopy);
        toast({ description: "Copied to clipboard!" });
    };

    const handleTopicSelect = (topic: string) => {
        form.setValue('topic', topic);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast({
            title: "Topic Selected!",
            description: `"${topic}" has been added to the input field.`,
        });
    };

    return (
        <div className="space-y-8">
            <PageTitle
                title="AI Content & SEO Studio"
                subtitle="Generate trending titles, descriptions, and tags for your social media and website."
            />
            
            <GlassCard>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <FormField
                            control={form.control}
                            name="topic"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Topic / Keywords</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., New Free Fire Tournament, Best Gaming Mouse" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="platform"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Platform</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a platform" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="glass-card">
                                            <SelectItem value="Google">Google (Website SEO)</SelectItem>
                                            <SelectItem value="Facebook">Facebook</SelectItem>
                                            <SelectItem value="Instagram">Instagram</SelectItem>
                                            <SelectItem value="TikTok">TikTok</SelectItem>
                                            <SelectItem value="X (Twitter)">X (Twitter)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto neon-accent-bg">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                            Generate Content
                        </Button>
                    </form>
                </Form>
            </GlassCard>

            <AnimatePresence>
                {(isLoading || generatedContent) && (
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                     >
                        <Separator />
                        <GlassCard className="mt-8">
                            <h3 className="text-xl font-semibold mb-4 text-foreground">Generated Content</h3>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin text-accent"/>
                                </div>
                            ) : generatedContent && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <ResultCard title="Title" icon={Type} onCopy={() => handleCopy(generatedContent.title)} hasContent={!!generatedContent.title}>
                                        <p>{generatedContent.title}</p>
                                    </ResultCard>
                                    <ResultCard title="Tags / Keywords" icon={Tags} onCopy={() => handleCopy(generatedContent.tags)} hasContent={generatedContent.tags.length > 0}>
                                        <div className="flex flex-wrap gap-2">
                                            {generatedContent.tags.map((tag, i) => <span key={i} className="bg-muted px-2 py-1 rounded-md text-muted-foreground">{tag}</span>)}
                                        </div>
                                    </ResultCard>
                                    <div className="md:col-span-2">
                                         <ResultCard title="Description" icon={FileText} onCopy={() => handleCopy(generatedContent.description)} hasContent={!!generatedContent.description}>
                                            <p className="whitespace-pre-wrap">{generatedContent.description}</p>
                                        </ResultCard>
                                    </div>
                                    <div className="md:col-span-2">
                                         <ResultCard title="AI Image Prompt" icon={ImageIcon} onCopy={() => handleCopy(generatedContent.imagePrompt)} hasContent={!!generatedContent.imagePrompt}>
                                            <p className="italic">{generatedContent.imagePrompt}</p>
                                        </ResultCard>
                                    </div>
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <Separator />

            <TrendingTopicsPanel onTopicSelect={handleTopicSelect} />

        </div>
    );
}
