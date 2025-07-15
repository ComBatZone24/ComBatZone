
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase/config';
import { ref, onValue } from 'firebase/database';
import type { GlobalSettings } from '@/types';
import DailyRewardDialog from './DailyRewardDialog';

// Helper function to check if a reward can be claimed today
const canClaimToday = (lastClaimTimestamp?: string): boolean => {
    if (!lastClaimTimestamp) return true; // Never claimed before
    try {
        const lastClaimDate = new Date(lastClaimTimestamp);
        const today = new Date();
        
        // Compare year, month, and day. Ignores time.
        return lastClaimDate.toDateString() !== today.toDateString();
    } catch (e) {
        console.error("Invalid date string for last claim:", lastClaimTimestamp);
        return true; // Allow claim if date is invalid
    }
};

const DailyRewardManager = () => {
    const { user, loading } = useAuth();
    const [settings, setSettings] = useState<GlobalSettings['dailyLoginRewards'] | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (!database) {
            setIsLoadingSettings(false);
            return;
        }
        const settingsRef = ref(database, 'globalSettings/dailyLoginRewards');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            setSettings(snapshot.exists() ? snapshot.val() : null);
            setIsLoadingSettings(false);
        }, () => setIsLoadingSettings(false));

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (loading || isLoadingSettings) return;

        const shouldShowDialog = 
            settings?.enabled && 
            user && 
            user.role !== 'admin' &&
            canClaimToday(user.lastLoginRewardClaim);

        if (shouldShowDialog) {
            setIsDialogOpen(true);
        }

    }, [user, settings, loading, isLoadingSettings]);

    if (!isDialogOpen || !user || !settings) {
        return null;
    }

    return (
        <DailyRewardDialog
            user={user}
            settings={settings}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
        />
    );
};

export default DailyRewardManager;
