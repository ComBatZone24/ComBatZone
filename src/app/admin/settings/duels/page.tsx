"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DuelsSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings/games');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Page Moved</h1>
      <p className="text-muted-foreground">
        This settings page has been merged into the new "Manage Games" page.
      </p>
      <p className="text-muted-foreground mt-1">
        Redirecting you now...
      </p>
       <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/settings/games">
             Go to Manage Games
          </Link>
        </Button>
    </div>
  );
}
