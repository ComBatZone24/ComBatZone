
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Ticket, Loader2, ArrowLeft, Trash2, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { RedeemCodeEntry } from '@/types';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase/config';
import { ref, set, onValue, off, remove, get } from 'firebase/database';
import PageTitle from '@/components/core/page-title';

interface InputFieldProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  icon?: React.ElementType;
  min?: string | number;
  step?: string | number;
}

const InputField: React.FC<InputFieldProps> = ({ id, label, value, onChange, type = "text", placeholder, description, icon: Icon, min, step }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-sm font-medium text-muted-foreground flex items-center">
      {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground/80" /> }
      {label}
    </Label>
    <Input 
      id={id} 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      className="bg-input/50 border-border/70 focus:border-accent text-base md:text-sm" 
      min={min}
      step={step}
    />
    {description && <p className="text-xs text-muted-foreground px-1">{description}</p>}
  </div>
);


export default function AdminRedeemCodePage() {
  const { toast } = useToast();
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [maxUses, setMaxUses] = useState<number | string>(1);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const [allCodes, setAllCodes] = useState<Array<RedeemCodeEntry & { codeString: string }>>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<(RedeemCodeEntry & { codeString: string }) | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);


  useEffect(() => {
    if (!database) {
      toast({ title: "Firebase Error", description: "Database not initialized. Cannot load codes.", variant: "destructive" });
      setIsLoadingCodes(false);
      return;
    }
    const codesRef = ref(database, 'redeemCodes');
    const listener = onValue(codesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedCodes = Object.keys(data).map(codeString => ({
          codeString,
          ...data[codeString],
        })).sort((a, b) => (b.createdAt && a.createdAt) ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : 0);
        setAllCodes(loadedCodes);
      } else {
        setAllCodes([]);
      }
      setIsLoadingCodes(false);
    }, (error) => {
      console.error("Error fetching redeem codes:", error);
      toast({ title: "Fetch Error", description: "Could not load redeem codes.", variant: "destructive" });
      setIsLoadingCodes(false);
    });
    return () => off(codesRef, 'value', listener);
  }, [toast]);

  const handleGenerateRedeemCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = parseFloat(redeemAmount);
    const numericMaxUses = parseInt(String(maxUses), 10);

    if (!redeemCode.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid code and amount (must be > 0).", variant: "destructive" });
      return;
    }
    if (isNaN(numericMaxUses) || numericMaxUses <= 0) {
      toast({ title: "Invalid Input", description: "Max uses must be a positive number.", variant: "destructive" });
      return;
    }

    setIsGeneratingCode(true);
    try {
      if (!database) throw new Error("Firebase not initialized");
      
      const codeString = redeemCode.trim().toUpperCase();
      const existingCodeRef = ref(database, `redeemCodes/${codeString}`);
      const existingCodeSnap = await get(existingCodeRef);
      if (existingCodeSnap.exists()) {
        toast({ title: "Code Exists", description: `Redeem code "${codeString}" already exists. Choose a different code.`, variant: "destructive" });
        setIsGeneratingCode(false);
        return;
      }

      const newCodeEntry: RedeemCodeEntry = {
        amount: numericAmount,
        isUsed: false,
        usedBy: null,
        createdAt: new Date().toISOString(),
        maxUses: numericMaxUses,
        timesUsed: 0,
        claimedBy: {},
      };
      
      await set(ref(database, `redeemCodes/${codeString}`), newCodeEntry);
      toast({
        title: "Redeem Code Generated",
        description: `Code "${codeString}" for Rs ${redeemAmount} (Max Uses: ${numericMaxUses}) created.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      setRedeemCode('');
      setRedeemAmount('');
      setMaxUses(1);
    } catch (error) {
      console.error("Error generating redeem code:", error);
      toast({ title: "Error", description: "Failed to generate redeem code. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsGeneratingCode(false);
    }
  };
  
  const handleDeleteCode = async () => {
    if (!codeToDelete || !codeToDelete.codeString || !database) {
      toast({ title: "Error", description: "No code selected or database error.", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    try {
      await remove(ref(database, `redeemCodes/${codeToDelete.codeString}`));
      toast({
        title: "Code Deleted",
        description: `Code "${codeToDelete.codeString}" has been successfully deleted.`,
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
      setCodeToDelete(null);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: "Could not delete code. " + (error.message || ""), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllCodes = async () => {
    if (!database) return;
    setIsDeletingAll(true);
    try {
      await remove(ref(database, 'redeemCodes'));
      toast({ title: "All Codes Deleted", description: "All redeem codes have been successfully removed.", variant: "default" });
      setIsDeleteAllDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: `Could not delete all codes: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const getCodeStatus = (code: RedeemCodeEntry & { codeString: string }) => {
    if ((code.timesUsed || 0) >= code.maxUses) return { text: "Fully Claimed", variant: "destructive" as const };
    return { text: "Active", variant: "secondary" as const };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle title="Redeem Code Management" subtitle="Create and manage one-time or multi-use gift codes." />
        <Button variant="outline" asChild>
          <Link href="/admin/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings Hub
          </Link>
        </Button>
      </div>

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-1">Create New Redeem Code</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Generate codes for users.
        </p>
        <Separator className="mb-6 bg-border/30" />
        <form onSubmit={handleGenerateRedeemCode} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <InputField
              id="redeemCodeString"
              label="Code String"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="E.g., WELCOME50"
            />
            <InputField
              id="redeemCodeAmount"
              label="Amount (Rs)"
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="E.g., 100"
              min="1"
            />
            <InputField
              id="maxUses"
              label="Max Uses"
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="E.g., 1"
              min="1"
            />
            <Button type="submit" className="neon-accent-bg md:mt-auto h-10 w-full lg:w-auto" disabled={isGeneratingCode}>
              {isGeneratingCode ? <Loader2 className="animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
              {isGeneratingCode ? 'Generating...' : 'Generate Code'}
            </Button>
          </div>
        </form>
      </GlassCard>
      
      <GlassCard className="p-0">
        <div className="p-4 border-b border-border/30 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Existing Redeem Codes</h3>
            <p className="text-sm text-muted-foreground">View and manage previously generated codes.</p>
          </div>
          <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={allCodes.length === 0}>
                <Trash2 className="mr-2 h-4 w-4"/> Delete All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>This will delete all {allCodes.length} redeem codes permanently. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAllCodes} disabled={isDeletingAll} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        {isLoadingCodes ? (
           <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="ml-3 text-muted-foreground">Loading codes...</p>
          </div>
        ) : allCodes.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No redeem codes found.</p>
        ) : (
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Amount (Rs)</TableHead>
                <TableHead className="text-center">Max Uses</TableHead>
                <TableHead className="text-center">Times Used</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allCodes.map((code) => {
                const status = getCodeStatus(code);
                return (
                  <TableRow key={code.codeString} className="border-b-border/20 hover:bg-muted/20">
                    <TableCell className="font-mono font-semibold text-foreground">{code.codeString}</TableCell>
                    <TableCell className="text-right">{code.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{code.maxUses}</TableCell>
                    <TableCell className="text-center">{code.timesUsed || 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={status.variant} className={cn(
                          status.variant === 'destructive' && 'bg-red-500/20 text-red-300 border-red-500/30',
                          status.variant === 'secondary' && 'bg-green-500/20 text-green-300 border-green-500/30',
                      )}>
                          {status.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(code.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 h-8 w-8" title="View Claims (Not Implemented)" onClick={() => toast({title: "Not Implemented", description: "Viewing claims per code is not yet available."})}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={isDeleteDialogOpen && codeToDelete?.codeString === code.codeString} onOpenChange={(isOpen) => { if (!isOpen) setCodeToDelete(null); setIsDeleteDialogOpen(isOpen);}}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 h-8 w-8" title="Delete Code" onClick={() => setCodeToDelete(code)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                           <AlertDialogContent className="glass-card">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Redeem Code: {code.codeString}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently delete the redeem code <span className="font-semibold text-foreground">"{code.codeString}"</span>. Users will no longer be able to claim it.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteCode} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                  {isDeleting ? <Loader2 className="animate-spin mr-2"/> : null} Delete Code
                                </AlertDialogAction>
                              </AlertDialogFooter>
                           </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
        )}
      </GlassCard>
    </div>
  );
}
