
"use client";

import { useState } from 'react';
import type { AppUpdateSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowUpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';

interface UpdateDialogProps {
  updateInfo: AppUpdateSettings;
}

export default function UpdateDialog({ updateInfo }: UpdateDialogProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleUpdate = () => {
    if (typeof window === 'undefined' || !window.median?.android) {
        toast({
            title: "Update Error",
            description: "This feature is only available in the native app.",
            variant: "destructive"
        });
        return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    const downloadSuccess = (result: { path: string }) => {
        setIsDownloading(false);
        toast({ title: "Download Complete", description: "Preparing to install..." });
        
        // Use the returned path to install the APK
        window.median.android.installApk({
            path: result.path,
            error: (err: any) => {
                console.error("Install Error:", err);
                toast({ title: "Install Failed", description: err.message || "Could not start installation.", variant: "destructive" });
            }
        });
    };

    const downloadError = (err: any) => {
        setIsDownloading(false);
        console.error("Download Error:", err);
        toast({ title: "Download Failed", description: err.message || "Could not download the update file.", variant: "destructive" });
    };

    const downloadProgressCallback = (progress: { total: number, written: number }) => {
        if (progress.total > 0) {
            const percentage = Math.round((progress.written / progress.total) * 100);
            setDownloadProgress(percentage);
        }
    };
    
    // Use Median.co's native download and install functionality
    window.median.android.downloadFile({
      url: updateInfo.apkUrl,
      fileName: "app-latest.apk", // Save with a specific name in the Downloads folder
      success: downloadSuccess,
      error: downloadError,
      progress: downloadProgressCallback,
    });
  };

  return (
    <Dialog open={true}>
      <DialogContent 
        className="glass-card sm:max-w-md"
        hideCloseButton={updateInfo.forceUpdate}
        onInteractOutside={(e) => {
            if (updateInfo.forceUpdate) {
                e.preventDefault();
            }
        }}
      >
        <DialogHeader className="text-center">
            <ArrowUpCircle className="mx-auto h-14 w-14 text-accent mb-4"/>
            <DialogTitle className="text-2xl">Update Available</DialogTitle>
            <DialogDescription>{updateInfo.updateMessage || 'A new version is available. Please update to continue.'}</DialogDescription>
        </DialogHeader>

        {isDownloading && (
            <div className="my-4">
                <Progress value={downloadProgress} className="w-full" />
                <p className="text-center text-sm text-muted-foreground mt-2">{downloadProgress}% downloaded...</p>
            </div>
        )}

        <DialogFooter>
          <Button onClick={handleUpdate} disabled={isDownloading} className="w-full neon-accent-bg text-lg py-3">
            {isDownloading ? <Loader2 className="animate-spin mr-2"/> : <ArrowUpCircle className="mr-2"/>}
            {isDownloading ? 'Downloading...' : 'Update Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
