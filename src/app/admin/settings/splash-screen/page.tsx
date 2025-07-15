// This file is deprecated and can be safely removed.
// The splash screen functionality has been removed from the application.
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedSplashScreenSettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/settings');
    }, [router]);

    return (
        <div className="flex justify-center items-center h-screen">
            <p>This feature has been removed. Redirecting to settings hub...</p>
        </div>
    );
}
