
"use client";

import { useState, useCallback } from 'react';
import type { YouTubePromotionSettings } from '@/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import { Gift, CheckCircle, Upload, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, serverTimestamp, get, push } from "firebase/database";
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
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
    const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);

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
            setSubmissionMessage(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.png', '.jpg'] },
        multiple: false
    });

    const handleSubmitForReview = async () => {
        if (!file || !user) {
            toast({ title: "Error", description: "Please select a screenshot file and ensure you are logged in.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        setUploadStatus('submitting');
        setSubmissionMessage(null);

        try {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
            });

            // Run AI verification first to get a recommendation
            const aiResult = await verifyYoutubeSubscription({
                screenshotDataUri: base64Data,
                expectedChannelName: settings.youtubeChannelName,
            });

            const db = getDatabase();
            const submissionRef = push(dbRef(db, `youtubeSubmissions`));

            const submissionData = {
                submissionId: submissionRef.key,
                userId: user.id,
                username: user.username,
                screenshotUrl: '', // This will be updated after upload
                status: 'pending', // All submissions are pending admin approval now
                submittedAt: serverTimestamp(),
                aiRecommendation: aiResult.verificationPassed ? 'approve' : 'reject',
                aiReason: aiResult.reason,
            };
            
            // Upload screenshot to Firebase Storage
            const storage = getStorage();
            const screenshotFileRef = storageRef(storage, `youtube-submissions/${user.id}/${submissionRef.key}.jpg`);
            const uploadResult = await uploadString(screenshotFileRef, base64Data, 'data_url');
            const downloadUrl = await getDownloadURL(uploadResult.ref);
            
            // Update the data object with the final URL
            submissionData.screenshotUrl = downloadUrl;

            // Save the complete data to the database
            await set(submissionRef, submissionData);

            setUploadStatus('submitted');
            toast({ title: "Submission Received", description: "Your subscription screenshot has been submitted for review. Please wait for admin approval.", className: "bg-green-500/20 text-green-300 border-green-500/30" });
            setSubmissionMessage("Your submission is pending review.");
            setFile(null);
            setPreview(null);
        
        } catch (error: any) {
            console.error("Submission error:", error);
            setUploadStatus('idle');
            setSubmissionMessage("An error occurred during submission.");
            toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
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
                <p className="text-xs text-muted-foreground mt-1">Subscribe, take a screenshot showing you're "Subscribed", and upload for admin approval.</p>
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
            
            <Button onClick={handleSubmitForReview} disabled={!file || isProcessing || uploadStatus === 'submitted'} className="w-full">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                {uploadStatus === 'idle' && 'Submit for Review'}
                {uploadStatus === 'submitting' && 'Submitting...'}
                {uploadStatus === 'submitted' && 'Submitted Successfully!'}
            </Button>

            {submissionMessage && (
                 <div className={`p-4 rounded-md text-sm bg-blue-500/10 text-blue-300`}>
                    <p className="font-semibold">{submissionMessage}</p>
                 </div>
            )}
        </div>
    );
}
