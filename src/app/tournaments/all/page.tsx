"use client";

import { useEffect } from "react";
import { useRouter } from 'next/navigation';

// This page is now redundant. Redirecting to the main tournaments page.
export default function AllTournamentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main tournaments page which now handles all filtering.
    router.replace('/tournaments');
  }, [router]);

  return (
    <div className="container mx-auto py-8 text-center">
        <p>Redirecting to the main tournaments page...</p>
    </div>
  );
}
