
'use server';

import { database } from '@/lib/firebase/config';
import { ref, runTransaction, push, serverTimestamp } from 'firebase/database';

export async function trackTaskClick(userId: string | null, offerwall: string) {
    if (!userId || !database || !offerwall) return;

    const sanitizedOfferwall = offerwall.replace(/[^a-zA-Z0-9-_]/g, '');
    if (!sanitizedOfferwall) return;

    try {
        // Update aggregate count
        const clickCounterRef = ref(database, `adminData/taskClicks/${sanitizedOfferwall}`);
        await runTransaction(clickCounterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        // Push a new log entry for the live feed
        const liveClicksRef = ref(database, 'adminData/liveTaskClicks');
        await push(liveClicksRef, {
            userId: userId,
            task: sanitizedOfferwall,
            timestamp: serverTimestamp(),
        });
        
        console.log(`Tracked ${sanitizedOfferwall} task click for user: ${userId}`);
    } catch (error) {
        console.error(`Failed to track ${sanitizedOfferwall} click:`, error);
    }
}
