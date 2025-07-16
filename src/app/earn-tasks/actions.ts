
'use server';

import { database } from '@/lib/firebase/config';
import { ref, runTransaction } from 'firebase/database';

export async function trackTaskClick(userId: string | null, offerwall: string) {
    if (!userId || !database || !offerwall) return;

    // Use a sanitized key for the offerwall name
    const sanitizedOfferwall = offerwall.replace(/[^a-zA-Z0-9-_]/g, '');
    if (!sanitizedOfferwall) return;

    const clickCounterRef = ref(database, `adminData/taskClicks/${sanitizedOfferwall}`);
    try {
        await runTransaction(clickCounterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });
        console.log(`Tracked ${sanitizedOfferwall} task click for user: ${userId}`);
    } catch (error) {
        console.error(`Failed to track ${sanitizedOfferwall} click:`, error);
    }
}
