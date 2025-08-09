
"use client";

import { useState, useEffect } from 'react';
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCog, PlusCircle, Edit3, Trash2, Loader2, Save, Users, ShieldAlert, Mail, MessageSquare as WhatsappIcon, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase/config';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, off, update, query, orderByChild, equalTo, get } from 'firebase/database';
import type { User as AppUserType } from '@/types';
import { adminNavItems } from '@/config/nav';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Label } from '@/components/ui/label';

interface DelegateAccessInfo {
  username: string;
  whatsappNumber?: string;
  accessScreens: Record<string, boolean>;
  createdAt?: string;
}
type DelegateMap = Record<string, DelegateAccessInfo>;

const delegateSchema = z.object({
  targetUserEmail: z.string().email("Please enter a valid email address."),
  whatsappNumber: z.string().optional(),
  accessScreens: z.record(z.boolean()).optional().refine(
    (screens) => !screens || Object.values(screens).some(v => v === true),
    { message: "At least one screen must be selected for a delegate." }
  ),
});
type DelegateFormValues = z.infer<typeof delegateSchema>;

const availableAdminScreens = adminNavItems
  .filter(item => item.permissionKey && !['manageDelegates', 'subAdmins'].includes(item.permissionKey))
  .map(item => ({ id: item.permissionKey!, label: item.title }));

type FoundUser = { uid: string; username: string; email: string };

export default function ManageDelegatesPage() {
  const { toast } = useToast();
  const [mainAdminUser, setMainAdminUser] = useState<FirebaseUser | null>(null);
  const [delegates, setDelegates] = useState<DelegateMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDelegateUID, setEditingDelegateUID] = useState<string | null>(null);
  
  const [delegateToDeleteUID, setDelegateToDeleteUID] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [isFindingUser, setIsFindingUser] = useState(false);
  const [userEmailToFind, setUserEmailToFind] = useState('');

  const form = useForm<DelegateFormValues>({
    resolver: zodResolver(delegateSchema),
    defaultValues: {
      targetUserEmail: "",
      whatsappNumber: "",
      accessScreens: {},
    },
  });

  useEffect(() => {
    if (!auth) { setIsLoading(false); return; }
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setMainAdminUser(user);
      if (!user) setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, [toast]);

  useEffect(() => {
    if (!mainAdminUser || !database) { setIsLoading(false); return; }
    setIsLoading(true);
    const usersRef = query(ref(database, 'users'), orderByChild('role'), equalTo('delegate'));
    const listener = onValue(usersRef, (snapshot) => {
      const delegatedUsers: DelegateMap = {};
      if(snapshot.exists()){
        snapshot.forEach(childSnapshot => {
          const userData = childSnapshot.val() as AppUserType;
          delegatedUsers[childSnapshot.key!] = {
            username: userData.username,
            whatsappNumber: userData.whatsappNumber,
            accessScreens: userData.delegatePermissions?.accessScreens || {},
            createdAt: userData.createdAt,
          };
        });
      }
      setDelegates(delegatedUsers);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching delegates:", error);
      toast({ title: "Fetch Error", description: "Could not load delegates.", variant: "destructive" });
      setIsLoading(false);
    });
    return () => off(usersRef, 'value', listener);
  }, [mainAdminUser, toast]);
  
  const findUserByEmail = async (email: string) => {
    setIsFindingUser(true);
    try {
        if (!database) return null;
        const usersRef = ref(database, 'users');
        const emailQuery = query(usersRef, orderByChild('email'), equalTo(email.trim()));
        const snapshot = await get(emailQuery);

        if (snapshot.exists()) {
            const usersData = snapshot.val();
            const uid = Object.keys(usersData)[0];
            const userData = usersData[uid] as AppUserType;
            if (uid === mainAdminUser?.uid) {
                 toast({ title: "Invalid Action", description: "You cannot delegate permissions to yourself.", variant: "destructive" });
                 return;
            }
            if (userData.role === 'delegate' || userData.role === 'admin') {
                toast({ title: "User Already Delegate/Admin", description: `${userData.username} already has elevated permissions.`, variant: "default" });
            }
            const userToAssign: FoundUser = { uid, ...userData };
            setFoundUser(userToAssign);
            form.setValue('targetUserEmail', userToAssign.email);
        } else {
             toast({ title: "User Not Found", description: `No user found with email ${email}.`, variant: "destructive" });
             setFoundUser(null);
        }
    } catch(err) {
        toast({ title: "Search Error", description: "An error occurred while searching for the user.", variant: "destructive" });
    } finally {
        setIsFindingUser(false);
    }
  };

  const handleCreateDelegate = async (data: DelegateFormValues) => {
    if (!foundUser) {
        toast({ title: "Error", description: "No user selected to assign.", variant: "destructive" });
        return;
    }
    await processFormSubmit(data, foundUser);
  };
  
  const processFormSubmit = async (data: DelegateFormValues, targetUser: FoundUser) => {
    if (!mainAdminUser || !database) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      const delegatePermissions = { accessScreens: data.accessScreens || {} };
      
      updates[`users/${targetUser.uid}/role`] = 'delegate';
      updates[`users/${targetUser.uid}/delegatePermissions`] = delegatePermissions;
      updates[`users/${targetUser.uid}/whatsappNumber`] = data.whatsappNumber || null;
      
      await update(ref(database), updates);

      toast({ title: "Permissions Updated", description: `Permissions for ${targetUser.username} updated successfully.`, className: "bg-green-500/20 text-green-300 border-green-500/30" });
      
      handleCloseCreateDialog();
      handleCloseEditDialog();

    } catch (error) {
       toast({ title: "Error", description: "Failed to update permissions.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleEditDelegate = (delegateUID: string, currentDelegate: DelegateAccessInfo) => {
    setEditingDelegateUID(delegateUID);
    form.reset({
      targetUserEmail: delegates[delegateUID]?.username || "",
      whatsappNumber: currentDelegate.whatsappNumber || "",
      accessScreens: currentDelegate.accessScreens || {},
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateDelegate = async (data: DelegateFormValues) => {
    if (!editingDelegateUID) return;
    const delegateInfo = delegates[editingDelegateUID];
    if (!delegateInfo) return;
    
    // We don't have email in delegateInfo, but it's not needed for the update logic.
    // The targetUser parameter just needs uid and username.
    const mockTargetUser: FoundUser = { uid: editingDelegateUID, username: delegateInfo.username, email: '' };
    await processFormSubmit(data, mockTargetUser);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setFoundUser(null);
    setUserEmailToFind('');
    form.reset({ targetUserEmail: "", whatsappNumber: "", accessScreens: {} });
  };
  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingDelegateUID(null);
    form.reset({ targetUserEmail: "", whatsappNumber: "", accessScreens: {} });
  };

  const confirmDeleteDelegate = (delegateUID: string) => {
    setDelegateToDeleteUID(delegateUID);
  };

  const handleDeleteDelegate = async () => {
    if (!delegateToDeleteUID || !database) return;
    setIsDeleting(true);
    try {
      const updates: Record<string, any> = {};
      updates[`users/${delegateToDeleteUID}/role`] = 'user'; // Revert role
      updates[`users/${delegateToDeleteUID}/delegatePermissions`] = null; // Remove permissions
      updates[`users/${delegateToDeleteUID}/whatsappNumber`] = null; // Remove WhatsApp number

      await update(ref(database), updates);
      
      toast({ title: "Delegate Revoked", description: `Delegate access revoked successfully.` });
      setDelegateToDeleteUID(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to revoke delegate access.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const renderAccessForm = (formContext: any, isEditMode = false) => {
    const handleSelectAll = () => {
      const allScreens = availableAdminScreens.reduce((acc, screen) => {
        acc[screen.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      formContext.setValue('accessScreens', allScreens, { shouldDirty: true, shouldValidate: true });
    };

    const handleClearAll = () => {
      formContext.setValue('accessScreens', {}, { shouldDirty: true, shouldValidate: true });
    };

    return (
    <Form {...formContext}>
      <form onSubmit={formContext.handleSubmit(isEditMode ? handleUpdateDelegate : handleCreateDelegate)} className="space-y-6">
        <FormField name="whatsappNumber" control={formContext.control} render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="whatsappNumber" className="flex items-center"><WhatsappIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Delegate's WhatsApp Number</FormLabel>
              <FormControl><Input id="whatsappNumber" {...field} type="tel" placeholder="e.g. 923001234567" className="mt-1 bg-input/50 border-border/70 focus:border-accent" /></FormControl>
              <FormMessage />
            </FormItem>
        )} />

        <FormField
          control={formContext.control}
          name="accessScreens"
          render={({ fieldState }) => (
            <FormItem>
              <div className="mb-2">
                <FormLabel className="text-md font-medium">Screen Access Permissions</FormLabel>
                <p className="text-xs text-muted-foreground">Select the screens this delegate can access.</p>
              </div>

              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant="outline" onClick={handleSelectAll}>Select All</Button>
                <Button type="button" size="sm" variant="destructive" onClick={handleClearAll}>Clear All</Button>
              </div>

              <ScrollArea className="h-64 border border-border/30 rounded-md p-3 bg-background/30">
                <div className="space-y-3">
                  {availableAdminScreens.map((screen) => (
                    <FormField
                      key={screen.id}
                      control={formContext.control}
                      name={`accessScreens.${screen.id}`}
                      render={({ field }) => (
                         <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">{screen.label}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </ScrollArea>
              {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
            </FormItem>
          )}
        />
        
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" onClick={isEditMode ? handleCloseEditDialog : handleCloseCreateDialog} disabled={isSubmitting}>Cancel</Button></DialogClose>
          <Button type="submit" className="neon-accent-bg" disabled={isSubmitting || !form.formState.isValid}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditMode ? 'Save Changes' : 'Assign Delegate'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
    );
  }

  if (isLoading && !mainAdminUser) {
    return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-accent" /><p className="ml-4 text-lg">Verifying admin status...</p></div>;
  }
  
  if (!mainAdminUser) {
     return <GlassCard className="m-4 p-6 text-center"><ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-3"/><h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2><p className="text-muted-foreground">You must be logged in as a Main Admin to manage delegates.</p></GlassCard>;
  }

  const delegateUIDs = Object.keys(delegates);

  return (
    <div className="flex h-full flex-col space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageTitle title="Manage Delegates" subtitle="Assign screen access permissions to other users." />
        <Button onClick={() => setIsCreateDialogOpen(true)} className="neon-accent-bg w-full sm:w-auto"><PlusCircle className="mr-2 h-5 w-5" /> Assign New Delegate</Button>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseCreateDialog(); }}>
          <DialogContent className="glass-card sm:max-w-lg">
             <DialogHeader>
                <DialogTitle className="text-xl text-accent">Assign New Delegate</DialogTitle>
                <DialogDescription>
                    {foundUser ? "Set permissions for the found user." : "First, find a user by their registered email address."}
                </DialogDescription>
             </DialogHeader>
             <Separator className="my-3"/>
             
             {!foundUser ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="find-user-email">User's Email</Label>
                        <div className="flex gap-2">
                            <Input id="find-user-email" type="email" placeholder="Enter user's email" value={userEmailToFind} onChange={(e) => setUserEmailToFind(e.target.value)} />
                            <Button onClick={() => findUserByEmail(userEmailToFind)} disabled={isFindingUser || !userEmailToFind}>
                                {isFindingUser ? <Loader2 className="animate-spin h-4 w-4"/> : <Search className="h-4 w-4"/>}
                            </Button>
                        </div>
                    </div>
                </div>
             ) : (
                <>
                <div className="p-3 bg-muted/40 rounded-md border border-border/50">
                    <p className="text-sm font-semibold text-foreground">{foundUser.username}</p>
                    <p className="text-xs text-muted-foreground">{foundUser.email}</p>
                </div>
                {renderAccessForm(form, false)}
                </>
             )}
          </DialogContent>
        </Dialog>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30"><h3 className="text-lg font-semibold text-foreground">Delegated Users ({delegateUIDs.length})</h3></div>
        {isLoading ? (<div className="flex-1 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /><p className="ml-3 text-muted-foreground">Loading delegates...</p></div>) 
        : delegateUIDs.length === 0 ? (<div className="flex-1 flex flex-col justify-center items-center text-center text-muted-foreground p-10"><Users className="h-16 w-16 text-muted-foreground/50 mb-4" />You haven't assigned any delegates yet.</div>) 
        : (
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader><TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10"><TableHead>Delegated User</TableHead><TableHead>WhatsApp</TableHead><TableHead>Accessible Screens</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {delegateUIDs.map((delegateUID) => {
                  const delegateInfo = delegates[delegateUID];
                  if (!delegateInfo) return null;
                  const grantedScreens = Object.keys(delegateInfo.accessScreens).filter(key => delegateInfo.accessScreens[key]);
                  return (
                    <TableRow key={delegateUID} className="border-b-border/20 hover:bg-muted/20">
                      <TableCell className="font-medium text-foreground">{delegateInfo.username}<p className="text-xs text-muted-foreground">UID: {delegateUID.substring(0,10)}...</p></TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{delegateInfo.whatsappNumber || 'Not Set'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {grantedScreens.slice(0, 4).map(screenKey => {
                            const screen = availableAdminScreens.find(s => s.id === screenKey);
                            return screen ? <span key={screenKey} className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-sm border border-border/50">{screen.label}</span> : null;
                          })}
                          {grantedScreens.length > 4 && <span className="text-xs text-muted-foreground px-1.5 py-0.5">+{grantedScreens.length - 4} more</span>}
                          {grantedScreens.length === 0 && <span className="text-xs text-destructive px-1.5 py-0.5">No Access</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Dialog open={isEditDialogOpen && editingDelegateUID === delegateUID} onOpenChange={(isOpen) => { if (!isOpen) handleCloseEditDialog() }}>
                          <DialogTrigger asChild><Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 h-8 w-8" onClick={() => handleEditDelegate(delegateUID, delegateInfo)}><Edit3 className="h-4 w-4" /></Button></DialogTrigger>
                          <DialogContent className="glass-card sm:max-w-lg">
                            <DialogHeader>
                               <DialogTitle className="text-xl text-accent">Edit Delegate: {delegateInfo.username}</DialogTitle>
                               <DialogDescription>Modify screen access and details for this delegated user.</DialogDescription>
                            </DialogHeader>
                            {renderAccessForm(form, true)}
                          </DialogContent>
                        </Dialog>
                        <AlertDialog open={delegateToDeleteUID === delegateUID} onOpenChange={(isOpen) => !isOpen && setDelegateToDeleteUID(null)}>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 h-8 w-8 ml-1" onClick={() => confirmDeleteDelegate(delegateUID)}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent className="glass-card"><AlertDialogHeader><AlertDialogTitle className="text-red-400">Revoke Delegate Access for: {delegateInfo.username}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently remove this user's delegated access permissions and revert their role to 'user'.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDelegateToDeleteUID(null)} disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteDelegate} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isDeleting ? <Loader2 className="animate-spin mr-2"/> : null} Revoke Access</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
       <GlassCard className="mt-8 p-6 border-l-4 border-blue-500 bg-blue-500/10">
        <div className="flex items-start">
          <ShieldAlert className="h-6 w-6 text-blue-400 mr-3 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-300 mb-1">Important Note on Delegate Access</h3>
            <p className="text-sm text-blue-400/80">
             Enforcing these restrictions (i.e., prevent a delegate from viewing unauthorized pages or accessing data) requires both this access record and correctly configured Firebase Security Rules. This page only manages the permission records on the user object.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
