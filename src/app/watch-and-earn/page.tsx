"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page has been replaced by /earn-tasks. Redirecting...
export default function DeprecatedWatchAndEarnPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/earn-tasks');
  }, [router]);

  return (
    <div className="container mx-auto py-8 text-center">
        <p>Redirecting to the new Earn Tasks page...</p>
    </div>
  );
}
