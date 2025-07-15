
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@/lib/firebase/config";
import { ref, push, onValue, off, update as rtdbUpdate, remove, serverTimestamp } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageTitle from "@/components/core/page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle, Trash2, Save, Vote, ToggleLeft, ToggleRight, X, Image as ImageIcon, Link as LinkIcon, MessageSquare, Edit3 } from "lucide-react";
import type { Poll, PromoPost } from "@/types";
import { Badge } from "@/components/ui/badge";
import GlassCard from "@/components/core/glass-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { getDisplayableBannerUrl } from "@/lib/image-helper";

const pollSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long."),
  options: z.array(z.object({ text: z.string().min(1, "Option text cannot be empty.") })).min(2, "Must have at least 2 options."),
  isActive: z.boolean(),
});

type PollFormValues = z.infer<typeof pollSchema>;

const promoPostSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  buttonText: z.string().optional(),
  buttonLink: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  enabled: z.boolean().default(true),
});
type PromoPostFormValues = z.infer<typeof promoPostSchema>;

export default function PollManagementPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);
  const { toast } = useToast();

  const [isPollFormOpen, setIsPollFormOpen] = useState(false);
  const [isPollDeleteOpen, setIsPollDeleteOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

  const [promoPosts, setPromoPosts] = useState<PromoPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isPostFormOpen, setIsPostFormOpen] = useState(false);
  const [isPostDeleteOpen, setIsPostDeleteOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PromoPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<PromoPost | null>(null);

  const pollForm = useForm<PollFormValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: { question: "", options: [{ text: "" }, { text: "" }], isActive: false },
  });
  const { fields, append, remove: removeOption } = useFieldArray({ control: pollForm.control, name: "options" });

  const postForm = useForm<PromoPostFormValues>({
    resolver: zodResolver(promoPostSchema),
    defaultValues: { title: "", description: "", imageUrl: "", buttonText: "", buttonLink: "", enabled: true },
  });

  useEffect(() => {
    if (!database) return;
    const pollsRef = ref(database, 'polls');
    const pollsListener = onValue(pollsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedPolls: Poll[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
      setPolls(loadedPolls);
      setLoadingPolls(false);
    });

    const promoPostsRef = ref(database, 'promoPosts');
    const promoPostsListener = onValue(promoPostsRef, (snapshot) => {
        const data = snapshot.val();
        const loadedPosts: PromoPost[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
        setPromoPosts(loadedPosts);
        setLoadingPosts(false);
    });

    return () => {
        off(pollsRef, 'value', pollsListener);
        off(promoPostsRef, 'value', promoPostsListener);
    }
  }, []);

  const handleTogglePollActive = async (poll: Poll) => {
    try {
        if(poll.isActive) {
             await rtdbUpdate(ref(database, `polls/${poll.id}`), { isActive: false });
             toast({ title: "Poll Deactivated", description: `"${poll.question}" is no longer active.` });
        } else {
            const updates: Record<string, any> = {};
            polls.forEach(p => { if(p.isActive) updates[`polls/${p.id}/isActive`] = false; });
            updates[`polls/${poll.id}/isActive`] = true;
            await rtdbUpdate(ref(database), updates);
            toast({ title: "Poll Activated", description: `"${poll.question}" is now the active poll.` });
        }
    } catch (error) {
        console.error("Error toggling poll status:", error);
        toast({ title: "Error", description: "Failed to update poll status.", variant: "destructive" });
    }
  };

  const onPollSubmit = async (data: PollFormValues) => {
    try {
      const optionsObject: { [key: string]: { id: string; text: string; votes: number } } = {};
      data.options.forEach((opt, index) => {
        const id = `option_${index + 1}`;
        optionsObject[id] = { id, text: opt.text, votes: 0 };
      });
      const newPollData = { question: data.question, options: optionsObject, isActive: data.isActive, createdAt: serverTimestamp(), voters: {} };
      const updates: Record<string, any> = {};
      if(data.isActive) { polls.forEach(p => { if(p.isActive) updates[`polls/${p.id}/isActive`] = false; }); }
      const newPollRef = push(ref(database, 'polls'));
      updates[`polls/${newPollRef.key}`] = newPollData;
      await rtdbUpdate(ref(database), updates);
      toast({ title: "Success", description: "New poll created successfully." });
      pollForm.reset();
      setIsPollFormOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create poll.", variant: "destructive" });
    }
  };

  const handleDeletePoll = async () => {
    if (!pollToDelete) return;
    try {
      await remove(ref(database, `polls/${pollToDelete.id}`));
      toast({ title: "Deleted", description: "Poll successfully deleted." });
      setIsPollDeleteOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete poll.", variant: "destructive" });
    }
  };

  const openCreatePostDialog = () => {
    setEditingPost(null);
    postForm.reset({ title: "", description: "", imageUrl: "", buttonText: "", buttonLink: "", enabled: true });
    setIsPostFormOpen(true);
  };

  const openEditPostDialog = (post: PromoPost) => {
    setEditingPost(post);
    postForm.reset({
        id: post.id,
        title: post.title || '',
        description: post.description || '',
        imageUrl: post.imageUrl || '',
        buttonText: post.buttonText || '',
        buttonLink: post.buttonLink || '',
        enabled: post.enabled
    });
    setIsPostFormOpen(true);
  };

  const onPostSubmit = async (data: PromoPostFormValues) => {
      const postDataForFirebase = {
          title: data.title,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          buttonText: data.buttonText || null,
          buttonLink: data.buttonLink || null,
          enabled: data.enabled,
          updatedAt: serverTimestamp(),
      };

      try {
          if (editingPost) {
              await rtdbUpdate(ref(database, `promoPosts/${editingPost.id}`), postDataForFirebase);
              toast({ title: "Post Updated", description: "Promotional post has been updated." });
          } else {
              const newPostData = { ...postDataForFirebase, createdAt: serverTimestamp() };
              await push(ref(database, 'promoPosts'), newPostData);
              toast({ title: "Post Created", description: "New promotional post has been created." });
          }
          setIsPostFormOpen(false);
          setEditingPost(null);
          postForm.reset();
      } catch (error: any) {
          console.error("Error saving post:", error);
          toast({ title: "Error saving post", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      }
  };
  
  const handleDeletePost = async () => {
    if(!postToDelete) return;
    try {
        await remove(ref(database, `promoPosts/${postToDelete.id}`));
        toast({ title: "Post Deleted", description: "Promotional post deleted." });
        setIsPostDeleteOpen(false);
    } catch(error) {
        toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
    }
  };
  
  const handleTogglePostEnabled = async (post: PromoPost) => {
      try {
          await rtdbUpdate(ref(database, `promoPosts/${post.id}`), { enabled: !post.enabled });
          toast({ title: "Status Updated", description: `Post is now ${!post.enabled ? 'enabled' : 'disabled'}.` });
      } catch (error) {
          toast({ title: "Error", description: "Failed to update post status.", variant: "destructive" });
      }
  };

  const getTotalVotes = (poll: Poll) => {
      if(!poll.options) return 0;
      return Object.values(poll.options).reduce((total, option) => total + (option.votes || 0), 0);
  }

  return (
    <>
      <div className="flex h-full flex-col space-y-6">
        <PageTitle title="Poll & Post Management" subtitle="Create community polls and manage promotional posts."/>
        
        <GlassCard>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Promotional Posts</CardTitle>
                    <CardDescription>Manage promotional posts displayed on the Polls page.</CardDescription>
                </div>
                <Button onClick={openCreatePostDialog}><PlusCircle className="mr-2 h-4 w-4"/>Create New Post</Button>
            </CardHeader>
            <CardContent>
                {loadingPosts ? <Loader2 className="h-6 w-6 animate-spin"/> :
                promoPosts.length === 0 ? <p className="text-muted-foreground text-center py-4">No promotional posts created yet.</p> :
                 <ScrollArea className="h-96 pr-3">
                    <div className="space-y-4">
                    {promoPosts.map(post => (
                        <div key={post.id} className="flex items-start gap-4 p-3 border rounded-lg bg-card/50">
                            <Image src={getDisplayableBannerUrl(post.imageUrl, post.title || 'Post')} alt={post.title || 'Post'} width={80} height={45} className="rounded-md object-cover aspect-video" />
                            <div className="flex-grow">
                                <p className="font-semibold text-foreground">{post.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{post.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={post.enabled} onCheckedChange={() => handleTogglePostEnabled(post)} title={post.enabled ? 'Disable Post' : 'Enable Post'} />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-400" onClick={() => openEditPostDialog(post)}><Edit3 className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => {setPostToDelete(post); setIsPostDeleteOpen(true);}}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                }
            </CardContent>
        </GlassCard>

        <GlassCard className="p-0 flex flex-1 flex-col">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Community Polls</CardTitle>
              <CardDescription>Create and manage community voting polls.</CardDescription>
            </div>
            <Button onClick={() => setIsPollFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Create New Poll</Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {loadingPolls ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> :
            polls.length === 0 ? <p className="text-center py-10 text-muted-foreground">No polls created yet.</p> :
              <div className="relative flex-1">
                 <ScrollArea className="absolute inset-0 p-4 space-y-4">
                  {polls.map(poll => {
                      const totalVotes = getTotalVotes(poll);
                      return (
                      <Card key={poll.id} className="bg-card/50">
                          <CardHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{poll.question}</CardTitle>
                                    <CardDescription>Created: {new Date(poll.createdAt).toLocaleDateString()}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Badge variant={poll.isActive ? "default" : "secondary"}>{poll.isActive ? "Active" : "Inactive"}</Badge>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTogglePollActive(poll)}>
                                        {poll.isActive ? <ToggleRight className="h-5 w-5 text-green-400" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPollToDelete(poll); setIsPollDeleteOpen(true); }}>
                                        <Trash2 className="h-4 w-4 text-red-400"/>
                                      </Button>
                                </div>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <div className="space-y-3">
                                  <p className="text-sm font-medium text-muted-foreground">Results ({totalVotes} total votes)</p>
                                  {poll.options && Object.values(poll.options).map(option => {
                                      const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes) * 100 : 0;
                                      return (
                                          <div key={option.id}>
                                              <div className="flex justify-between items-center mb-1 text-sm">
                                                  <span className="text-foreground">{option.text}</span>
                                                  <span className="text-muted-foreground">{option.votes || 0} votes ({percentage.toFixed(1)}%)</span>
                                              </div>
                                              <Progress value={percentage} className="h-2" indicatorClassName="bg-accent"/>
                                          </div>
                                      )
                                  })}
                              </div>
                          </CardContent>
                      </Card>
                  )})}
                </ScrollArea>
              </div>
            }
          </CardContent>
        </GlassCard>
      </div>

      <Dialog open={isPollFormOpen} onOpenChange={setIsPollFormOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader><DialogTitle>Create New Poll</DialogTitle></DialogHeader>
           <Form {...pollForm}>
              <form onSubmit={pollForm.handleSubmit(onPollSubmit)} className="space-y-6">
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-6">
                    <FormField control={pollForm.control} name="question" render={({ field }) => (
                        <FormItem><FormLabel>Poll Question</FormLabel><FormControl><Input placeholder="Who should we collab with?" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="space-y-2">
                        <FormLabel>Options</FormLabel>
                         <div className="space-y-4">
                            {fields.map((field, index) => (
                                <FormField key={field.id} control={pollForm.control} name={`options.${index}.text`} render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                        <FormControl><Input placeholder={`Option ${index + 1}`} {...field} /></FormControl>
                                        {fields.length > 2 && <Button type="button" variant="destructive" size="icon" onClick={() => removeOption(index)}><X className="h-4 w-4"/></Button>}
                                    </FormItem>
                                )}/>
                            ))}
                        </div>
                    </div>
                     <Button type="button" size="sm" variant="outline" onClick={() => append({ text: "" })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                    </Button>
                    <FormField control={pollForm.control} name="isActive" render={({ field }) => (
                        <FormItem className="flex items-center justify-between pt-2">
                            <FormLabel className="flex flex-col"><span>Make this poll active immediately?</span><span className="text-xs text-muted-foreground">This will deactivate any other active poll.</span></FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                  </div>
                </ScrollArea>
                <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={pollForm.formState.isSubmitting}>
                    {pollForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Create Poll
                    </Button>
                </DialogFooter>
              </form>
           </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isPollDeleteOpen} onOpenChange={setIsPollDeleteOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the poll "{pollToDelete?.question}". This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePoll} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPostFormOpen} onOpenChange={setIsPostFormOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingPost ? "Edit Post" : "Create New Post"}</DialogTitle></DialogHeader>
           <Form {...postForm}>
              <form onSubmit={postForm.handleSubmit(onPostSubmit)} className="space-y-4">
                 <FormField control={postForm.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Post Title</FormLabel><FormControl><Input placeholder="e.g. Special Event!" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={postForm.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Post Description</FormLabel><FormControl><Textarea placeholder="Details about the promotion..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={postForm.control} name="imageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL (Google Drive compatible)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={postForm.control} name="buttonText" render={({ field }) => (
                    <FormItem><FormLabel>Button Text (Optional)</FormLabel><FormControl><Input placeholder="e.g. Learn More" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={postForm.control} name="buttonLink" render={({ field }) => (
                    <FormItem><FormLabel>Button Link URL (Optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={postForm.control} name="enabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between pt-2">
                        <FormLabel>Enable this post</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={postForm.formState.isSubmitting}>
                        {postForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {editingPost ? "Save Changes" : "Create Post"}
                    </Button>
                </DialogFooter>
              </form>
           </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPostDeleteOpen} onOpenChange={setIsPostDeleteOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the post "{postToDelete?.title}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
