// This file is deprecated and can be safely removed.
// The splash screen functionality has been removed from the application.
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedSplashScreenPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/settings');
    }, [router]);

    return (
        <div className="flex justify-center items-center h-screen">
            <p>This page has been removed. Redirecting...</p>
        </div>
    );
}
