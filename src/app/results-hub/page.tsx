"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is now consolidated into /tournaments.
export default function ResultsHubRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tournaments');
  }, [router]);

  return (
    <div className="container mx-auto py-8 text-center">
        <p>Redirecting to the main tournaments page...</p>
    </div>
  );
}
