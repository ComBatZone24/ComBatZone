"use client";

import { useState, useCallback, ChangeEvent } from 'react';
import type { YouTubePromotionSettings } from '@/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import { User, Gift, CheckCircle, Upload, Loader2, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, serverTimestamp } from "firebase/database";
import { verifyYoutubeSubscription } from '@/ai/flows/verify-youtube-subscription-flow';

interface YoutubePromotionTaskProps {
    settings: YouTubePromotionSettings;
}

export default function YoutubePromotionTask({ settings }: YoutubePromotionTaskProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationResult, setVerificationResult] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            const currentFile = acceptedFiles[0];
            setFile(currentFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(currentFile);
            setUploadStatus('idle');
            setVerificationResult(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.png', '.jpg'] },
        multiple: false
    });

    const handleUploadAndVerify = async () => {
        if (!file || !user) {
            toast({ title: "Error", description: "Please select a screenshot file and ensure you are logged in.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        setUploadStatus('uploading');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result as string;
                
                // AI Verification
                setUploadStatus('verifying');
                const aiResult = await verifyYoutubeSubscription({
                    screenshotDataUri: base64Data,
                    expectedChannelName: settings.youtubeChannelName,
                });

                if (aiResult.verificationPassed) {
                    setVerificationResult("Verification successful! Points have been awarded.");
                    setUploadStatus('success');
                     toast({ title: "Verified!", description: aiResult.reason, className: "bg-green-500/20 text-green-300 border-green-500/30" });
                    // TODO: Award points logic here
                } else {
                    setVerificationResult(`Verification Failed: ${aiResult.reason}`);
                    setUploadStatus('failed');
                     toast({ title: "Verification Failed", description: aiResult.reason, variant: "destructive" });
                }
            };
        } catch (error: any) {
            console.error("Verification error:", error);
            setVerificationResult("An error occurred during verification.");
            setUploadStatus('failed');
            toast({ title: "Error", description: "An unexpected error occurred during verification.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="relative rounded-lg overflow-hidden border-2 border-border/50">
                <div className="relative h-24 sm:h-32 w-full">
                    <Image src={getDisplayableBannerUrl(settings.youtubeChannelBannerUrl)} alt="Channel Banner" fill style={{objectFit: "cover"}} />
                </div>
                <div className="flex items-center gap-4 p-4 bg-background/50 -mt-10 relative z-10">
                     <Image src={getDisplayableBannerUrl(settings.youtubeChannelProfileUrl)} alt="Channel Profile" width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-background" />
                     <div className="flex-1">
                        <h4 className="font-bold text-lg text-foreground">{settings.youtubeChannelName}</h4>
                        <p className="text-xs text-muted-foreground">Subscribe to earn points!</p>
                     </div>
                     <Button asChild>
                        <a href={settings.youtubeChannelUrl} target="_blank" rel="noopener noreferrer">Subscribe</a>
                     </Button>
                </div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-accent/10 border border-accent/30">
                <p className="font-bold text-accent flex items-center justify-center gap-2"><Gift className="h-5 w-5"/> Reward: {settings.pointsForSubscription} Points</p>
                <p className="text-xs text-muted-foreground mt-1">Subscribe to the channel, take a screenshot showing you are "Subscribed", and upload it below.</p>
            </div>
            
             <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-accent bg-accent/20' : 'border-border/50 hover:border-accent'}`}>
                <input {...getInputProps()} />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2"/>
                {file ? (
                    <p className="text-foreground">File selected: <span className="font-semibold">{file.name}</span></p>
                ) : (
                    <p className="text-muted-foreground">Drop a screenshot here, or click to select a file.</p>
                )}
            </div>

            {preview && (
                 <div className="mt-4">
                    <h5 className="font-semibold text-sm mb-2">Screenshot Preview:</h5>
                    <Image src={preview} alt="Screenshot preview" width={500} height={300} className="rounded-md border max-w-full h-auto" />
                </div>
            )}
            
            <Button onClick={handleUploadAndVerify} disabled={!file || isProcessing} className="w-full">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                {uploadStatus === 'idle' && 'Upload & Verify'}
                {uploadStatus === 'uploading' && 'Uploading...'}
                {uploadStatus === 'verifying' && 'Verifying with AI...'}
                {uploadStatus === 'success' && 'Verified!'}
                {uploadStatus === 'failed' && 'Verification Failed'}
            </Button>

            {verificationResult && (
                 <div className={`p-4 rounded-md text-sm ${uploadStatus === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                    <p className="font-semibold">{verificationResult}</p>
                 </div>
            )}
        </div>
    );
}
