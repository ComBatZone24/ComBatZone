
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CrashGameRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Feature Removed</h1>
      <p className="text-muted-foreground">
        This feature has been removed. Redirecting you to the homepage...
      </p>
    </div>
  );
}
