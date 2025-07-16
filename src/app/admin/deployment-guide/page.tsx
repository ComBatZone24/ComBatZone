
"use client";

import GlassCard from "@/components/core/glass-card";
import PageTitle from "@/components/core/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Terminal, CheckCircle, ExternalLink, FolderCog, FileCode, Download, Wand2, UploadCloud } from "lucide-react";
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
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:12345:web:abcdef12345
`.trim();

    const folderStructure = `
my-arena-ace-app/
├── src/
├── public/
├── package.json
├── next.config.js
└── .env.local  <-- YEH FILE YAHAN BANANI HAI
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
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 1: Prerequisites</h2>
                <p className="text-muted-foreground mb-4">Shuru karne se pehle, yeh cheezein aapke computer par honi chahiye:</p>
                <ul className="list-disc list-inside space-y-2 text-foreground">
                    <li><strong className="font-semibold">Node.js:</strong> Iski zaroorat aapki app ko chalanay ke liye hai. Ise <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">nodejs.org</a> se download karein.</li>
                    <li><strong className="font-semibold">Git:</strong> Code ko GitHub par dalne ke liye yeh zaroori hai. Ise <a href="https://git-scm.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">git-scm.com</a> se download karein.</li>
                    <li><strong className="font-semibold">GitHub Account:</strong> Vercel aapke code ko live karne ke liye GitHub ka istemal karta hai. <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">github.com</a> par account banayein.</li>
                </ul>
            </GlassCard>

            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 2: Local Setup</h2>
                <p className="text-muted-foreground mb-2">Apne download kiye hue project ko unzip karein. Ab aap jis folder mein hain (jahan `package.json` file hai), woh aapka **main project folder** hai. Iske andar, terminal (Command Prompt) kholein.</p>
                
                <Separator className="my-4" />
                
                <h3 className="font-semibold mb-2 flex items-center"><Terminal className="mr-2 h-5 w-5"/>Install Dependencies</h3>
                <p className="text-muted-foreground mb-2">Yeh command chala kar app ki tamam zaroori packages install karein:</p>
                <CodeBlock>npm install</CodeBlock>
                <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                <PromptBlock>
                    A high-resolution, clean screenshot of a computer terminal on a dark background. The terminal shows the 'npm install' command being executed, with lines of text indicating package installation progress. The text should be sharp and readable in a monospace font. The overall aesthetic should be modern and professional, suitable for a web development tutorial.
                </PromptBlock>

                <Separator className="my-4" />

                <h3 className="font-semibold mb-2 flex items-center"><FileCode className="mr-2 h-5 w-5"/>Create Environment File</h3>
                <p className="text-muted-foreground mb-2">Apne project ke main folder (jahan `package.json` file hai) mein, ek nayi file banayein jiska naam <strong className="text-foreground">`.env.local`</strong> rakhein. Niche diye gaye code ko copy karke is file mein paste karein aur Firebase keys ki jagah apni asal keys dalein. Yeh keys aapko apne Firebase Project Settings se milengi.</p>
                <CodeBlock className="text-xs">{folderStructure}</CodeBlock>
                <CodeBlock>{firebaseConfigCode}</CodeBlock>
                <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                <PromptBlock>
                    A high-resolution, professional screenshot of a modern code editor (like VS Code) with a dark theme. The file explorer on the left should show a typical Next.js project structure, with the `.env.local` file clearly highlighted or selected. The main editor window on the right should display the contents of the `.env.local` file, showing several 'NEXT_PUBLIC_FIREBASE_' keys with placeholder values like 'your-project-id'. The code should be clear and readable.
                </PromptBlock>
            </GlassCard>
            
            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 3: Upload to GitHub</h2>
                <p className="text-muted-foreground mb-4">Ab, aapko apna project apne GitHub account par upload karna hai. Apne project ke main folder mein terminal khola rakhein.</p>
                <ul className="list-decimal list-inside space-y-4">
                    <li><strong className="font-semibold">Initialize Git:</strong> Terminal mein yeh command chalayein. Is se aapke folder mein Git shuru ho jayega.
                        <CodeBlock>git init</CodeBlock>
                    </li>
                    <li><strong className="font-semibold">Add All Files:</strong> Ab tamam files ko Git mein add karein.
                        <CodeBlock>git add .</CodeBlock>
                    </li>
                     <li><strong className="font-semibold">Commit Your Files:</strong> Files ko commit karke ek message dein.
                        <CodeBlock>git commit -m "First commit"</CodeBlock>
                    </li>
                    <li><strong className="font-semibold">Create a GitHub Repository:</strong> <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">github.com/new</a> par ja kar ek nayi repository banayein. Isay koi bhi naam dein (jaise "arena-ace-app"). Repository ko <strong className="text-foreground">Public</strong> rakhein. <strong className="text-foreground">"Initialize this repository with"</strong> ke neeche kisi bhi box (README, .gitignore) ko check na karein. "Create repository" button par click karein.
                     <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                    <PromptBlock>
                        A clean, bright screenshot of the GitHub "Create a new repository" page. The owner and repository name fields should be visible. The "Public" option should be selected, and all checkboxes under "Initialize this repository with" should be unchecked. The green "Create repository" button should be visible at the bottom.
                    </PromptBlock>
                    </li>
                    <li><strong className="font-semibold">Push to GitHub:</strong> Naye page par, "...or push an existing repository from the command line" ke niche di gayi commands ko ek ek karke apne terminal mein chalayein. Woh aisi dikhengi:
                        <CodeBlock>{`git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`}</CodeBlock>
                         <p className="text-xs text-muted-foreground mt-1">Note: `YOUR_USERNAME` aur `YOUR_REPOSITORY` ki jagah aapka apna username aur repository ka naam hoga.</p>
                    </li>
                </ul>
            </GlassCard>

            <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent">Step 4: Deploy to Vercel</h2>
                <p className="text-muted-foreground mb-4">Yeh aakhri step hai aapki app ko live karne ke liye.</p>
                <ul className="list-decimal list-inside space-y-4">
                    <li><a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">vercel.com</a> par jayein aur apne GitHub account se sign up karein.</li>
                    <li>Vercel dashboard par "Add New..." par click karke "Project" select karein.</li>
                     <li>Apni GitHub repository ko list se select karke **Import** karein.</li>
                     <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                     <PromptBlock>
                        A clear screenshot of the Vercel "Import Git Repository" page. The page should show a list of GitHub repositories, with one repository highlighted or selected. The Vercel logo and user avatar should be visible in the top corners. The overall UI should be clean and modern.
                     </PromptBlock>
                    <li><strong className="text-destructive font-bold">Deploy se pehle:</strong> "Environment Variables" section ko kholein. Apni computer ki `.env.local` file se har line ko (naam aur value) yahan ek-ek karke copy paste karein. Yeh sab se zaroori step hai.</li>
                    <h4 className="text-xs font-semibold mt-4 text-muted-foreground flex items-center"><Wand2 className="mr-2 h-3 w-3"/>AI Image Prompt</h4>
                     <PromptBlock>
                        A focused screenshot of the Vercel project configuration page, highlighting the "Environment Variables" section. The view should clearly show multiple input fields for a variable's 'Name' and 'Value', with examples like 'NEXT_PUBLIC_FIREBASE_API_KEY' filled in. The "Deploy" button should be visible but not the main focus.
                     </PromptBlock>
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

             <GlassCard>
                <h2 className="text-xl font-semibold mb-4 text-accent flex items-center"><UploadCloud className="mr-2"/> App Ko Update Kaise Karein?</h2>
                <p className="text-muted-foreground mb-4">Jab bhi aap Firebase Studio mein code tabdeel karein, usay live karne ke liye aapko bas yeh 3 commands apne terminal mein chalani hain:</p>
                <ol className="list-decimal list-inside space-y-2">
                    <li><strong className="font-semibold">Add files:</strong> <code className="font-mono bg-muted px-1 rounded-sm">git add .</code></li>
                    <li><strong className="font-semibold">Commit changes:</strong> <code className="font-mono bg-muted px-1 rounded-sm">git commit -m "Your update message"</code></li>
                    <li><strong className="font-semibold">Push to GitHub:</strong> <code className="font-mono bg-muted px-1 rounded-sm">git push</code></li>
                </ol>
                <p className="text-sm text-muted-foreground mt-4">Jaise hi aap `git push` karenge, Vercel aapki website ko khud-ba-khud update kar dega.</p>
            </GlassCard>

        </div>
    );
}
