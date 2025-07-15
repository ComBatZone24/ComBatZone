
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page has been removed as the feature is no longer supported.
// It will now redirect users to the homepage.
export default function RemovedMiningPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <h1 className="text-xl font-semibold text-foreground mb-2">Feature Removed</h1>
      <p className="text-muted-foreground">
        The mining feature has been removed. Redirecting you to the homepage...
      </p>
    </div>
  );
}
