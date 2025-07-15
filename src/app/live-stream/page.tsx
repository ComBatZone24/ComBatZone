"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// This page has been removed.
export default function LiveStreamRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="container mx-auto py-8 text-center">
        <p>This page no longer exists. Redirecting...</p>
    </div>
  );
}
