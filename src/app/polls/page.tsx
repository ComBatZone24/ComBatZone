
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { database } from "@/lib/firebase/config";
import { ref, onValue, off, update, runTransaction, get } from "firebase/database";
import type { Poll, PromoPost } from "@/types";
import { useToast } from "@/hooks/use-toast";
import PageTitle from "@/components/core/page-title";
import GlassCard from "@/components/core/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Vote, ExternalLink, Info, CheckCircle } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { getDisplayableBannerUrl } from "@/lib/image-helper";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const PollsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [promoPosts, setPromoPosts] = useState<PromoPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userVotedOption, setUserVotedOption] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (!database) {
      setIsLoading(false);
      return;
    }

    const pollsRef = ref(database, 'polls');
    const postsRef = ref(database, 'promoPosts');

    const pollsListener = onValue(pollsRef, (snapshot) => {
      const allPolls = snapshot.val();
      if (allPolls) {
        const activePollId = Object.keys(allPolls).find(key => allPolls[key].isActive === true);
        const active = activePollId ? { id: activePollId, ...allPolls[activePollId] } : undefined;
        setActivePoll(active || null);
      } else {
        setActivePoll(null);
      }
    });

    const postsListener = onValue(postsRef, (snapshot) => {
      const allPosts = snapshot.val();
      if (allPosts) {
        const enabledPosts = Object.keys(allPosts)
            .map(key => ({ id: key, ...allPosts[key] }))
            .filter((post: PromoPost) => post.enabled)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPromoPosts(enabledPosts);
      } else {
        setPromoPosts([]);
      }
    });

    Promise.all([get(pollsRef), get(postsRef)]).finally(() => {
        setIsLoading(false);
    });

    return () => {
      off(pollsRef, 'value', pollsListener);
      off(postsRef, 'value', postsListener);
    };
  }, []);

  useEffect(() => {
    if (user && activePoll?.voters) {
      const hasVoted = Object.keys(activePoll.voters).some(voterId => voterId === user.id);
      if (hasVoted) {
        setUserVotedOption('voted');
      } else {
        setUserVotedOption(null);
      }
    }
  }, [user, activePoll]);


  const handleVote = async (optionId: string) => {
    if (!user || !activePoll || userVotedOption) return;

    setIsVoting(true);
    const voteRef = ref(database, `polls/${activePoll.id}/options/${optionId}/votes`);
    const voterRef = ref(database, `polls/${activePoll.id}/voters/${user.id}`);

    try {
      const voterSnap = await get(voterRef);
      if (voterSnap.exists()) {
        toast({ title: "Already Voted", description: "You have already cast your vote in this poll.", variant: "destructive" });
        setUserVotedOption('voted');
        setIsVoting(false);
        return;
      }

      await runTransaction(voteRef, (currentVotes) => (currentVotes || 0) + 1);
      await update(ref(database, `polls/${activePoll.id}/voters`), { [user.id]: true });

      toast({ title: "Vote Cast!", description: "Thank you for your feedback.", className: "bg-green-500/20" });
      setUserVotedOption(optionId);
    } catch (error) {
      toast({ title: "Error", description: "Could not cast your vote.", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };
  
  const totalVotes = activePoll ? Object.values(activePoll.options || {}).reduce((total, option) => total + (option.votes || 0), 0) : 0;
  const hasVoted = !!userVotedOption;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <PageTitle title="Polls & Posts" subtitle="Have your say and check out the latest updates." />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            {activePoll && (
                 <GlassCard>
                    <CardHeader>
                        <CardTitle className="text-xl text-accent">{activePoll.question}</CardTitle>
                        <CardDescription>{totalVotes} total votes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Object.entries(activePoll.options || {}).map(([optionId, option]) => {
                             const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes) * 100 : 0;
                            return (
                                <div key={optionId}>
                                    {hasVoted ? (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium">{option.text}</span>
                                                <span className="text-muted-foreground">{percentage.toFixed(1)}% ({option.votes || 0})</span>
                                            </div>
                                            <Progress value={percentage} className="h-3" />
                                        </div>
                                    ) : (
                                        <Button 
                                            variant="outline"
                                            className="w-full justify-start h-auto py-3 text-left"
                                            onClick={() => handleVote(optionId)}
                                            disabled={isVoting}
                                        >
                                            {isVoting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            {option.text}
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                         {!user && !hasVoted && (
                            <Alert variant="default" className="mt-4 bg-primary/10 border-primary/30 text-primary-foreground/80">
                                <Info className="h-4 w-4 !text-primary"/>
                                <AlertTitle className="text-primary">Login to Vote</AlertTitle>
                                <AlertDescription>You must be logged in to participate in the poll.</AlertDescription>
                            </Alert>
                         )}
                    </CardContent>
                </GlassCard>
            )}
        </div>

        <div className="lg:col-span-1 space-y-6">
            <h3 className="text-xl font-semibold text-foreground border-b-2 border-accent pb-1">Latest Posts</h3>
            {promoPosts.length > 0 ? (
                promoPosts.map(post => (
                    <GlassCard key={post.id} className="p-0 overflow-hidden group">
                        {post.imageUrl && (
                            <div className="relative aspect-video">
                                <Image src={getDisplayableBannerUrl(post.imageUrl, post.title)} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                        )}
                        <div className="p-4">
                            <h4 className="font-bold text-lg">{post.title}</h4>
                            {post.description && <p className="text-sm text-muted-foreground mt-1">{post.description}</p>}
                            {post.buttonText && post.buttonLink && (
                                <Button asChild size="sm" className="mt-3 w-full">
                                    <Link href={post.buttonLink} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4"/>
                                        {post.buttonText}
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </GlassCard>
                ))
            ) : (
                 <p className="text-sm text-muted-foreground text-center py-4">No posts to display.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default PollsPage;
