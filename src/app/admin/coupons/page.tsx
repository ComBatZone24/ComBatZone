
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@/lib/firebase/config";
import { ref, push, onValue, off, update, remove, get } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageTitle from "@/components/core/page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Eye, TicketPercent, PlusCircle, Edit3, Trash2, Save } from "lucide-react";
import type { Coupon, ShopItem, User as AppUserType } from "@/types";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import GlassCard from "@/components/core/glass-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogClose,
  DialogTrigger,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(3, "Code must be at least 3 characters").max(20).transform(val => val.toUpperCase()),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().min(0.01, "Discount must be positive"),
  startDate: z.string().refine((val) => val, { message: 'Start date is required' }),
  expiryDate: z.string().refine((val) => val, { message: 'Expiry date is required' }),
  usageLimit: z.coerce.number().min(1, "Usage limit must be at least 1"),
  appliesTo: z.enum(['full_shop', 'per_item']),
  applicableItemIds: z.array(z.string()).optional(),
  isActive: z.boolean(),
}).refine(data => {
    if (data.appliesTo === 'per_item') {
        return data.applicableItemIds && data.applicableItemIds.length > 0;
    }
    return true;
}, {
    message: "At least one specific item must be selected.",
    path: ['applicableItemIds'],
}).refine(data => new Date(data.startDate) < new Date(data.expiryDate), {
    message: "Start date must be before expiry date",
    path: ['expiryDate'],
});

type CouponFormValues = z.infer<typeof couponSchema>;
type Claimant = { user: AppUserType, claim: { purchaseId: string, timestamp: string } };

export default function CouponManagementPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  const [isClaimsDialogOpen, setIsClaimsDialogOpen] = useState(false);
  const [viewingClaimsForCoupon, setViewingClaimsForCoupon] = useState<Coupon | null>(null);
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);


  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      discountType: "percentage",
      discountValue: undefined,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      expiryDate: "",
      usageLimit: 100,
      appliesTo: "full_shop",
      applicableItemIds: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (!database) return;
    const couponsRef = ref(database, 'coupons');
    const listener = onValue(couponsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedCoupons: Coupon[] = [];
      if (data) {
        Object.keys(data).forEach(key => {
          loadedCoupons.push({ id: key, ...data[key] });
        });
      }
      setCoupons(loadedCoupons.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching coupons:", error);
      toast({ title: "Fetch Error", description: "Could not load coupons.", variant: "destructive" });
      setLoading(false);
    });
    return () => off(couponsRef, 'value', listener);
  }, [toast]);
  
  useEffect(() => {
    if (!database) return;
    const itemsRef = ref(database, 'shopItems');
    const listener = onValue(itemsRef, (snapshot) => {
        const data = snapshot.val();
        const loadedItems: ShopItem[] = [];
        if (data) {
            Object.keys(data).forEach(key => {
                loadedItems.push({ id: key, ...data[key] });
            });
        }
        setShopItems(loadedItems);
        setIsLoadingItems(false);
    }, (error) => {
        console.error("Error fetching shop items:", error);
        toast({ title: "Shop Items Error", description: "Could not load shop items for selection.", variant: "destructive" });
        setIsLoadingItems(false);
    });
    return () => off(itemsRef, 'value', listener);
  }, [toast]);

  const openCreateDialog = () => {
    setEditingCoupon(null);
    form.reset({
      code: "",
      discountType: "percentage",
      discountValue: undefined,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      expiryDate: "",
      usageLimit: 100,
      appliesTo: "full_shop",
      applicableItemIds: [],
      isActive: true,
    });
    setIsFormDialogOpen(true);
  };
  
  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    form.reset({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      startDate: format(parseISO(coupon.startDate), 'yyyy-MM-dd'),
      expiryDate: format(parseISO(coupon.expiryDate), 'yyyy-MM-dd'),
      usageLimit: coupon.usageLimit,
      appliesTo: coupon.appliesTo,
      applicableItemIds: coupon.applicableItemIds || [],
      isActive: coupon.isActive,
    });
    setIsFormDialogOpen(true);
  };

  const onSubmit = async (data: CouponFormValues) => {
    if (!database) {
      toast({ title: "Database Error", description: "Database not initialized.", variant: "destructive" });
      return;
    }

    try {
      if (editingCoupon) {
        // Update existing coupon
        const couponRef = ref(database, `coupons/${editingCoupon.id}`);
        await update(couponRef, { ...data, updatedAt: new Date().toISOString() });
        toast({ title: "Success", description: "Coupon updated successfully." });
      } else {
        // Create new coupon
        const newCouponData = {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usedCount: 0,
        };
        await push(ref(database, "coupons"), newCouponData);
        toast({ title: "Success", description: "Coupon added successfully." });
      }
      form.reset();
      setIsFormDialogOpen(false);
      setEditingCoupon(null);

    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast({ title: "Error", description: error.message || "Failed to save coupon.", variant: "destructive" });
    }
  };

  const handleDeleteCoupon = async () => {
    if (!couponToDelete) return;
    try {
      await remove(ref(database, `coupons/${couponToDelete.id}`));
      toast({ title: "Deleted", description: "Coupon successfully deleted." });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete coupon.", variant: "destructive" });
    }
  };

  const handleViewClaims = async (coupon: Coupon) => {
    setViewingClaimsForCoupon(coupon);
    setIsClaimsDialogOpen(true);
    setIsLoadingClaims(true);
    setClaimants([]);
    
    if (!coupon.claimedBy || Object.keys(coupon.claimedBy).length === 0) {
      setIsLoadingClaims(false);
      return;
    }

    try {
      const claimsData = coupon.claimedBy;
      const loadedClaimants: Claimant[] = [];
      
      const userFetchPromises = Object.keys(claimsData).map(userId => 
        get(ref(database, `users/${userId}`)).then(snapshot => ({ userId, snapshot }))
      );
      
      const userSnapshots = await Promise.all(userFetchPromises);

      for (const { userId, snapshot } of userSnapshots) {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const userClaims = claimsData[userId];
          if (Array.isArray(userClaims)) {
              userClaims.forEach(claim => {
                loadedClaimants.push({ user: { id: userId, ...userData }, claim });
              });
          }
        }
      }
      setClaimants(loadedClaimants.sort((a,b) => new Date(b.claim.timestamp).getTime() - new Date(a.claim.timestamp).getTime()));
    } catch (error) {
      console.error("Error fetching claimants:", error);
      toast({ title: "Error", description: "Could not load claims data.", variant: "destructive" });
    } finally {
      setIsLoadingClaims(false);
    }
  };

  const CouponForm = ({ isEditMode }: { isEditMode: boolean }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem><FormLabel>Coupon Code</FormLabel><FormControl><Input placeholder="E.g., SAVE10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="discountType" render={({ field }) => (
            <FormItem><FormLabel>Discount Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="discountValue" render={({ field }) => (
            <FormItem><FormLabel>Discount Value</FormLabel><FormControl><Input type="number" placeholder="Enter value" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="usageLimit" render={({ field }) => (
            <FormItem><FormLabel>Usage Limit</FormLabel><FormControl><Input type="number" placeholder="Enter usage limit" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="expiryDate" render={({ field }) => (
            <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="appliesTo" render={({ field }) => (
          <FormItem><FormLabel>Applies To</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="full_shop">Full Shop</SelectItem><SelectItem value="per_item">Specific Items</SelectItem></SelectContent></Select><FormMessage /></FormItem>
        )} />
        {form.watch('appliesTo') === 'per_item' && (
          <FormField control={form.control} name="applicableItemIds" render={() => (
            <FormItem>
              <FormLabel>Applicable Products</FormLabel><FormMessage />
              <ScrollArea className="h-52 rounded-md border p-4">
                {isLoadingItems ? <Loader2 className="animate-spin" /> :
                  shopItems.length === 0 ? <p className='text-sm text-muted-foreground'>No shop items found to select.</p> :
                  shopItems.map((item) => (
                    <FormField key={item.id} control={form.control} name="applicableItemIds" render={({ field }) => (
                      <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 mb-2">
                        <FormControl>
                          <Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => {
                            const currentIds = field.value || [];
                            const newIds = checked ? [...currentIds, item.id] : currentIds.filter((id) => id !== item.id);
                            field.onChange(newIds);
                          }} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{item.name} - <span className='text-muted-foreground'>Rs {item.price}</span></FormLabel>
                      </FormItem>
                    )} />
                  ))}
              </ScrollArea>
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex items-center justify-between pt-2"><FormLabel className="flex flex-col"><span>Active</span><span className="text-xs text-muted-foreground">Coupon can be used immediately if active.</span></FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
        )} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            {isEditMode ? "Save Changes" : "Create Coupon"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageTitle title="Coupon Management" subtitle="Create and manage discount codes for your shop."/>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add New Coupon</Button>
      </div>
      <GlassCard className="p-0 flex flex-1 flex-col">
        <CardHeader>
          <CardTitle>Existing Coupons</CardTitle>
          <CardDescription>View all currently available coupons in the system.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> :
            <div className="relative flex-1">
               <ScrollArea className="absolute inset-0">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map(coupon => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-semibold">{coupon.code}</TableCell>
                        <TableCell>{coupon.discountType}</TableCell>
                        <TableCell>{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `Rs ${coupon.discountValue}`}</TableCell>
                        <TableCell>{coupon.usedCount || 0}/{coupon.usageLimit}</TableCell>
                        <TableCell>
                          <Badge variant={coupon.isActive ? "default" : "secondary"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewClaims(coupon)}><Eye className="h-4 w-4 text-blue-400"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(coupon)}><Edit3 className="h-4 w-4 text-yellow-400"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCouponToDelete(coupon); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-red-400"/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          }
        </CardContent>
      </GlassCard>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingCoupon ? "Edit Coupon" : "Add New Coupon"}</DialogTitle><DialogDescriptionComponent>Fill in the details for your new discount coupon.</DialogDescriptionComponent></DialogHeader>
          <CouponForm isEditMode={!!editingCoupon} />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the coupon "{couponToDelete?.code}". This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCoupon} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isClaimsDialogOpen} onOpenChange={setIsClaimsDialogOpen}>
        <DialogContent className="glass-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Claims for "{viewingClaimsForCoupon?.code}"</DialogTitle>
            <DialogDescriptionComponent>Users who have used this coupon.</DialogDescriptionComponent>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-2">
            {isLoadingClaims ? (
              <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : claimants.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No claims recorded for this coupon yet.</p>
            ) : (
              <ul className="space-y-3">
                {claimants.map(({ user, claim }, index) => (
                  <li key={`${user.id}-${index}`} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-primary/30">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.username}</p>
                        <p className="text-xs text-muted-foreground">Claimed: {format(new Date(claim.timestamp), 'PPp')}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
