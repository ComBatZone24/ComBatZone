// This file has been removed as the feature is now handled by the Ad Monetization page.
// This placeholder is to ensure the file system deletes the file correctly.
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RemovedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings');
  }, [router]);

  return null;
}
