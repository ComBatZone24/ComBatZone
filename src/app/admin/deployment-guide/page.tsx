
"use client";

import GlassCard from "@/components/core/glass-card";
import PageTitle from "@/components/core/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Terminal, CheckCircle, ExternalLink, FolderCog, FileCode, Download, Wand2, UploadCloud, KeyRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CodeBlock = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <pre className={cn("bg-muted p-3 rounded-md text-sm text-foreground overflow-x-auto font-mono my-2", className)}>
        <code>{children}</code>
    </pre>
);

const PromptBlock = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-primary/10 p-3 rounded-md border border-primary/30 mt-2">
        <p className="text-sm text-primary/90 font-mono">{children}</p>
    </div>
);


export default function DeploymentGuidePage() {
    const firebaseConfigCode = `
# Public keys for browser access
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:12345:web:abcdef12345

# Secret keys for server-side API (Admin SDK)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
`.trim();

    const folderStructure = `
my-arena-ace-app/
├── src/
├── public/
├── package.json
├── next.config.js
└── .env.local  <-- YEH FILE YAHAN BANANI HAI
`.trim();

    const serviceAccountJsonExample = `
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEv...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  ...
}
`.trim();

    return (
        <div className="space-y-8">
            <PageTitle
                title="Deployment Guide"
                subtitle="Step-by-step instructions to deploy your app to Vercel."
            />

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Note</AlertTitle>
                <AlertDescription>
                    This guide assumes you have downloaded your project code from Firebase Studio. Your database and authentication will remain on Firebase; we are only changing where the website code is hosted.
                </AlertDescription>
            </Alert>
            
            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent flex items-center"><KeyRound className="mr-2 h-5 w-5"/> Step 1: Find Your Firebase Keys</h2>
                <p className="text-muted-foreground mb-4">Vercel ko aapke Firebase project se connect karne ke liye kuch secret "keys" ki zaroorat hai. Yeh keys aapko apne Firebase project ki settings se milengi.</p>
                <div className="space-y-4 text-sm">
                    <div>
                        <h3 className="font-semibold text-foreground">A. Public Keys (for Browser)</h3>
                        <p className="text-xs text-muted-foreground mb-2">Yeh keys aapki app ko browser mein Firebase se connect karti hain.</p>
                        <ol className="list-decimal list-inside space-y-1 pl-2">
                            <li>Firebase Console mein apne project par jayein.</li>
                            <li>Project Settings (gear icon) par click karein.</li>
                            <li>General tab mein, neeche "Your apps" section tak scroll karein.</li>
                            <li>Apni Web App (SDK setup and configuration) ko select karein.</li>
                            <li>Config option ko select karein. Yahan aapko yeh tamam keys milengi:</li>
                        </ol>
                        <CodeBlock className="text-xs mt-2">{`
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
                        `.trim()}</CodeBlock>
                    </div>
                    <Separator/>
                    <div>
                        <h3 className="font-semibold text-foreground">B. Secret/Admin Keys (for Server API)</h3>
                        <p className="text-xs text-muted-foreground mb-2">Yeh keys aapke server ko admin access deti hain. Inhein hamesha secret rakhein.</p>
                        <ol className="list-decimal list-inside space-y-1 pl-2">
                            <li>Project Settings mein, "Service accounts" tab par click karein.</li>
                            <li>"Generate new private key" button par click karein. Aik JSON file download hogi.</li>
                            <li>Is JSON file ko text editor mein kholein. Aapko yeh tamam values wahan mil jayengi:</li>
                        </ol>
                         <CodeBlock className="text-xs mt-2">{`
FIREBASE_PROJECT_ID (JSON file mein "project_id")
FIREBASE_CLIENT_EMAIL (JSON file mein "client_email")
FIREBASE_PRIVATE_KEY (JSON file mein "private_key")
                        `.trim()}</CodeBlock>
                        <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Yeh JSON file bohot sensitive hai. Isay kisi ke saath share na karein. Values copy karne ke baad isay delete kar dein.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </GlassCard>

             <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 2: Set Environment Variables in Vercel</h2>
                <p className="text-muted-foreground mb-2">
                    Yeh sab se zaroori qadam hai. Apni Firebase JSON file se values ko Vercel project ke Environment Variables mein set karein.
                </p>
                <h3 className="font-semibold text-foreground">Mapping JSON file to Vercel Variables:</h3>
                 <div className="mt-2 text-sm">
                    <p>Aapki service account JSON file aisi dikhti hai:</p>
                    <CodeBlock className="text-xs">{serviceAccountJsonExample}</CodeBlock>
                    <p>Aapko is file se Vercel mein yeh 3 variables set karne hain:</p>
                    <ul className="list-disc space-y-2 pl-5 mt-2">
                        <li>
                            <strong className="font-mono text-foreground">FIREBASE_PROJECT_ID</strong>
                            <p className="text-xs text-muted-foreground">Value: JSON file se <code className="bg-muted px-1 rounded-sm">project_id</code> ki value copy karein.</p>
                        </li>
                        <li>
                            <strong className="font-mono text-foreground">FIREBASE_CLIENT_EMAIL</strong>
                            <p className="text-xs text-muted-foreground">Value: JSON file se <code className="bg-muted px-1 rounded-sm">client_email</code> ki value copy karein.</p>
                        </li>
                        <li>
                            <strong className="font-mono text-foreground">FIREBASE_PRIVATE_KEY</strong>
                             <p className="text-xs text-muted-foreground">
                                Value: JSON file se <code className="bg-muted px-1 rounded-sm">private_key</code> ki poori value copy karein.
                                Yeh <code className="bg-muted px-1 rounded-sm">-----BEGIN PRIVATE KEY-----</code> se shuru ho kar <code className="bg-muted px-1 rounded-sm">-----END PRIVATE KEY-----\n</code> tak hogi.
                            </p>
                        </li>
                    </ul>
                     <p className="text-muted-foreground mt-4">
                        Iske alawa, apni tamam <strong className="text-foreground">Public Keys</strong> (`NEXT_PUBLIC_...`) ko bhi Vercel ke Environment Variables mein add karein.
                    </p>
                    <Alert variant="default" className="mt-4 bg-blue-500/10 border-blue-500/50">
                        <AlertCircle className="h-4 w-4 !text-blue-400" />
                        <AlertTitle className="text-blue-300">Vercel Warning Note</AlertTitle>
                        <AlertDescription className="text-blue-400/80">
                            Jab aap `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` jaisi key Vercel mein daalte hain, to Vercel aapko aik warning dega. Yeh normal hai. Firebase ki public keys browser mein istemal ke liye hi hoti hain. Aap is warning ko ignore kar ke key save kar sakte hain.
                        </AlertDescription>
                    </Alert>
                </div>
                <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                <PromptBlock>
                    A focused screenshot of the Vercel project configuration page, highlighting the "Environment Variables" section. The view should clearly show multiple input fields for a variable's 'Name' and 'Value', with examples like 'FIREBASE_PROJECT_ID' and 'NEXT_PUBLIC_FIREBASE_API_KEY' filled in. The "Deploy" button should be visible but not the main focus.
                </PromptBlock>
            </GlassCard>

            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 3: Local Setup &amp; GitHub</h2>
                <p className="text-muted-foreground mb-2">Ab apne code ko GitHub par upload karne ke liye tayyar karein.</p>
                
                <Separator className="my-4" />
                
                <h3 className="font-semibold mb-2 flex items-center"><Terminal className="mr-2 h-5 w-5"/>Install Dependencies</h3>
                <p className="text-muted-foreground mb-2">Apne project folder mein terminal (Command Prompt) khol kar yeh command chalayein:</p>
                <CodeBlock>npm install</CodeBlock>

                <Separator className="my-4" />

                <h3 className="font-semibold mb-2 flex items-center"><FileCode className="mr-2 h-5 w-5"/>Create Environment File (for local testing)</h3>
                <p className="text-muted-foreground mb-2">Apne project ke main folder mein, ek nayi file banayein jiska naam <strong className="text-foreground">`.env.local`</strong> rakhein. Step 1 se mili hui tamam keys (public aur secret) ko is file mein paste karein.</p>
                <CodeBlock className="text-xs">{folderStructure}</CodeBlock>
                <CodeBlock>{firebaseConfigCode}</CodeBlock>

                 <Separator className="my-4" />

                <h3 className="font-semibold mb-2 flex items-center"><UploadCloud className="mr-2 h-5 w-5"/>Push to GitHub</h3>
                <p className="text-muted-foreground mb-2">Ab apna code GitHub par upload karein:</p>
                <ol className="list-decimal list-inside space-y-4">
                    <li><strong className="font-semibold">Initialize Git:</strong> <CodeBlock>git init</CodeBlock></li>
                    <li><strong className="font-semibold">Add All Files:</strong> <CodeBlock>git add .</CodeBlock></li>
                     <li><strong className="font-semibold">Commit Your Files:</strong> <CodeBlock>git commit -m "Initial commit"</CodeBlock></li>
                    <li><strong className="font-semibold">Create a GitHub Repository:</strong> <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">github.com/new</a> par ja kar ek nayi repository banayein.</li>
                    <li><strong className="font-semibold">Push to GitHub:</strong> GitHub par di gayi commands ko apne terminal mein chalayein.</li>
                </ol>
            </GlassCard>
            
            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 4: Deploy to Vercel</h2>
                <p className="text-muted-foreground mb-4">Yeh aakhri step hai aapki app ko live karne ke liye.</p>
                <ul className="list-decimal list-inside space-y-4">
                    <li><a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">vercel.com</a> par jayein aur apne GitHub account se sign up karein.</li>
                    <li>Vercel dashboard par "Add New..." par click karke "Project" select karein.</li>
                     <li>Apni GitHub repository ko list se select karke **Import** karein.</li>
                    <li><strong className="text-destructive font-bold">Deploy se pehle:</strong> "Environment Variables" section mein (jaisa Step 2 mein bataya gaya hai) apni tamam Firebase keys add karein.</li>
                    <li>Jab tamam environment variables add ho jayein, tab **"Deploy"** button par click karein. Vercel ab aapki app ko build karke live kar dega.</li>
                </ul>
            </GlassCard>

            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-green-400 flex items-center"><CheckCircle className="mr-2"/> Mubarak Ho!</h2>
                <p className="text-muted-foreground mb-4">Aapki application ab internet par live hai! Vercel aapko ek URL dega jahan se aap usay access kar sakte hain.</p>
                <Button asChild>
                    <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2"/> Visit Vercel
                    </a>
                </Button>
            </GlassCard>

        </div>
    );
}
