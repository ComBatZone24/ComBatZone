"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// This page has been removed. Live stream settings are now part of YouTube Promotion.
export default function RemovedLiveStreamSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings/youtube-promotion');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Page Merged</h1>
      <p className="text-muted-foreground">
        Live Stream settings are now part of the "YouTube Promotion" page.
      </p>
       <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/settings/youtube-promotion">
             Go to YouTube Promotion
          </Link>
        </Button>
    </div>
  );
}
