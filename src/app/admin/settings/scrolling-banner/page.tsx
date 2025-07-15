
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@/lib/firebase/config";
import { ref, push, onValue, off, update, remove, serverTimestamp } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import PageTitle from "@/components/core/page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, PlusCircle, Trash2, Save, Image as ImageIcon, Link as LinkIcon, Edit3, ArrowLeft } from "lucide-react";
import type { PromoPost } from "@/types"; // Re-using PromoPost type as it fits perfectly
import GlassCard from "@/components/core/glass-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { getDisplayableBannerUrl } from "@/lib/image-helper";
import Link from 'next/link';

const bannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  buttonText: z.string().optional(),
  buttonLink: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  enabled: z.boolean().default(true),
});
type BannerFormValues = z.infer<typeof bannerSchema>;

export default function ScrollingBannerPage() {
  const [banners, setBanners] = useState<PromoPost[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoPost | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<PromoPost | null>(null);

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { title: "", description: "", imageUrl: "", buttonText: "", buttonLink: "", enabled: true },
  });

  useEffect(() => {
    if (!database) return;
    const bannersRef = ref(database, 'scrollingBanners');
    const bannersListener = onValue(bannersRef, (snapshot) => {
        const data = snapshot.val();
        const loadedBanners: PromoPost[] = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
        setBanners(loadedBanners);
        setLoadingBanners(false);
    });

    return () => off(bannersRef, 'value', bannersListener);
  }, []);

  const openCreateDialog = () => {
    setEditingBanner(null);
    form.reset({ title: "", description: "", imageUrl: "", buttonText: "", buttonLink: "", enabled: true });
    setIsFormOpen(true);
  };

  const openEditDialog = (banner: PromoPost) => {
    setEditingBanner(banner);
    form.reset({
        id: banner.id,
        title: banner.title || '',
        description: banner.description || '',
        imageUrl: banner.imageUrl || '',
        buttonText: banner.buttonText || '',
        buttonLink: banner.buttonLink || '',
        enabled: banner.enabled
    });
    setIsFormOpen(true);
  };

  const onBannerSubmit = async (data: BannerFormValues) => {
      const bannerDataForFirebase = {
          title: data.title,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          buttonText: data.buttonText || null,
          buttonLink: data.buttonLink || null,
          enabled: data.enabled,
          updatedAt: serverTimestamp(),
      };

      try {
          if (editingBanner) {
              await update(ref(database, `scrollingBanners/${editingBanner.id}`), bannerDataForFirebase);
              toast({ title: "Banner Updated", description: "Scrolling banner has been updated." });
          } else {
              const newBannerData = { ...bannerDataForFirebase, createdAt: serverTimestamp() };
              await push(ref(database, 'scrollingBanners'), newBannerData);
              toast({ title: "Banner Created", description: "New scrolling banner has been created." });
          }
          setIsFormOpen(false);
          setEditingBanner(null);
          form.reset();
      } catch (error: any) {
          console.error("Error saving banner:", error);
          toast({ title: "Error saving banner", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      }
  };
  
  const handleDeleteBanner = async () => {
    if(!bannerToDelete) return;
    try {
        await remove(ref(database, `scrollingBanners/${bannerToDelete.id}`));
        toast({ title: "Banner Deleted", description: "Scrolling banner deleted." });
        setIsDeleteOpen(false);
    } catch(error) {
        toast({ title: "Error", description: "Failed to delete banner.", variant: "destructive" });
    }
  };
  
  const handleToggleEnabled = async (banner: PromoPost) => {
      try {
          await update(ref(database, `scrollingBanners/${banner.id}`), { enabled: !banner.enabled });
          toast({ title: "Status Updated", description: `Banner is now ${!banner.enabled ? 'enabled' : 'disabled'}.` });
      } catch (error) {
          toast({ title: "Error", description: "Failed to update banner status.", variant: "destructive" });
      }
  };

  return (
    <>
      <div className="flex h-full flex-col space-y-6">
        <div className="flex items-center justify-between">
          <PageTitle title="Scrolling Banner Management" subtitle="Manage banners displayed on the homepage."/>
          <Button variant="outline" asChild>
            <Link href="/admin/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings</Link>
          </Button>
        </div>
        
        <GlassCard>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold">Homepage Banners</h3>
                    <p className="text-muted-foreground text-sm">Create and manage promotional banners for the user homepage.</p>
                </div>
                <Button onClick={openCreateDialog} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4"/>Create New Banner</Button>
            </div>
            <div className="mt-6">
                {loadingBanners ? <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div> :
                banners.length === 0 ? <p className="text-muted-foreground text-center py-4">No banners created yet.</p> :
                 <div className="space-y-4">
                    {banners.map(banner => (
                        <div key={banner.id} className="flex flex-col sm:flex-row items-start gap-4 p-3 border rounded-lg bg-card/50">
                            <Image src={getDisplayableBannerUrl(banner.imageUrl, banner.title || 'Post')} alt={banner.title || 'Post'} width={128} height={72} className="rounded-md object-cover aspect-video flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <p className="font-semibold text-foreground truncate">{banner.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{banner.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                                <Switch checked={banner.enabled} onCheckedChange={() => handleToggleEnabled(banner)} title={banner.enabled ? 'Disable Banner' : 'Enable Banner'} />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-400" onClick={() => openEditDialog(banner)}><Edit3 className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => {setBannerToDelete(banner); setIsDeleteOpen(true);}}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    ))}
                    </div>
                }
            </div>
        </GlassCard>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingBanner ? "Edit Banner" : "Create New Banner"}</DialogTitle></DialogHeader>
           <Form {...form}>
              <form onSubmit={form.handleSubmit(onBannerSubmit)} className="space-y-4">
                 <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g. Grand Tournament Announcement" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Details about this banner..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL (Google Drive compatible)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="buttonText" render={({ field }) => (
                    <FormItem><FormLabel>Button Text (Optional)</FormLabel><FormControl><Input placeholder="e.g. Learn More" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="buttonLink" render={({ field }) => (
                    <FormItem><FormLabel>Button Link URL (Optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="enabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between pt-2">
                        <FormLabel>Enable this banner</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {editingBanner ? "Save Changes" : "Create Banner"}
                    </Button>
                </DialogFooter>
              </form>
           </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the banner "{bannerToDelete?.title}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBanner} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
