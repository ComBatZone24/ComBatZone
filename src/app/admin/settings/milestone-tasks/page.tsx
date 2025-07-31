// This page has been removed as the feature is no longer supported.
// This file can be safely deleted in a future cleanup.
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RemovedMilestoneTasksPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect users to the main settings page if they land here.
    router.replace('/admin/settings');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-center">
      <h1 className="text-xl font-semibold text-foreground mb-2">Feature Removed</h1>
      <p className="text-muted-foreground">
        This feature has been removed. Redirecting you to the settings hub...
      </p>
    </div>
  );
}
