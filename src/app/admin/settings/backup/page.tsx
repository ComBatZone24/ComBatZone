"use client";

import { useState } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Upload, AlertCircle, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export default function BackupAndRestorePage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    toast({ title: "Starting Backup", description: "Fetching all database records..." });
    try {
      if (!database) throw new Error("Database not initialized");
      const dbRef = ref(database);
      const snapshot = await get(dbRef);
      if (!snapshot.exists()) {
        toast({ title: "No Data", description: "Database is empty, nothing to back up.", variant: "destructive" });
        return;
      }
      const data = snapshot.val();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateString = format(new Date(), 'yyyy-MM-dd');
      link.download = `arena-ace-backup-${dateString}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Backup Complete", description: "Database backup has been downloaded successfully.", className: "bg-green-500/20" });

    } catch (error: any) {
      console.error("Backup failed:", error);
      toast({ title: "Backup Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/json') {
        setBackupFile(file);
      } else {
        toast({ title: "Invalid File", description: "Please select a valid .json file.", variant: "destructive" });
        setBackupFile(null);
        e.target.value = ''; // Reset file input
      }
    }
  };

  const handleRestoreBackup = () => {
    if (!backupFile) {
        toast({ title: "No File", description: "Please select a backup file to restore.", variant: "destructive" });
        return;
    }
    
    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const content = e.target?.result;
            if (typeof content !== 'string') throw new Error("Could not read file content.");
            
            const jsonData = JSON.parse(content);
            if (!database) throw new Error("Database not initialized");
            
            await set(ref(database), jsonData);

            toast({ title: "Restore Successful", description: "Database has been restored from the backup file.", className: "bg-green-500/20" });
            
            // Optional: force a refresh or redirect to signify completion
            window.location.reload();

        } catch (error: any) {
            console.error("Restore failed:", error);
            let errorMessage = error.message;
            if(error instanceof SyntaxError){
                errorMessage = "The selected file is not a valid JSON file."
            }
            toast({ title: "Restore Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setIsUploading(false);
            setBackupFile(null);
            const input = document.getElementById('backup-file-input') as HTMLInputElement | null;
            if(input) input.value = '';
        }
    };

    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
        setIsUploading(false);
    };
    
    reader.readAsText(backupFile);
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Database Backup & Restore" subtitle="Manage your application's data backups." />

      <GlassCard>
        <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <Download className="text-accent" /> Download Full Backup
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download a complete snapshot of your entire Firebase Realtime Database as a JSON file. It is recommended to do this regularly.
        </p>
        <Button onClick={handleDownloadBackup} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isDownloading ? 'Backing Up...' : 'Download Backup'}
        </Button>
      </GlassCard>

      <GlassCard className="border-destructive/50">
        <h3 className="text-xl font-semibold text-destructive mb-2 flex items-center gap-2">
          <Upload className="text-destructive" /> Restore From Backup
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a previously downloaded JSON backup file to restore the database.
        </p>

        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warning: Irreversible Action</AlertTitle>
          <AlertDescription>
            Restoring from a backup will <strong className="font-bold">COMPLETELY OVERWRITE</strong> your entire current database with the data from the file. This action cannot be undone.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full space-y-1">
                <Label htmlFor="backup-file-input">Select Backup File (.json)</Label>
                <Input id="backup-file-input" type="file" accept=".json" onChange={handleFileChange} className="file:text-foreground bg-input/50" />
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!backupFile || isUploading} className="w-full sm:w-auto">
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                        Restore Database
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Final Confirmation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you absolutely sure you want to overwrite the entire database with the contents of <span className="font-semibold text-foreground">{backupFile?.name}</span>? All current data will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreBackup} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Yes, Restore Database</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </GlassCard>
    </div>
  );
}
