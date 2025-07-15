
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// This page has been deprecated. All relevant settings are now in YouTube Promotion and Click & Earn Links.
export default function DeprecatedWatchAndEarnPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Page Moved</h1>
      <p className="text-muted-foreground">
        "Watch & Earn" settings are now managed in "YouTube Promotion" and "Click & Earn Links".
      </p>
      <p className="text-muted-foreground mt-1">
        Redirecting you to the main settings hub...
      </p>
       <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/settings">
             Go to Settings Hub
          </Link>
        </Button>
    </div>
  );
}
