
import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/firebase/config';
import { ref, get, runTransaction, push, serverTimestamp, set } from 'firebase/database';
import type { GlobalSettings, WalletTransaction, User } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('sub1');
  const secretKey = searchParams.get('sub2');
  const payoutStr = searchParams.get('payout');
  const offerId = searchParams.get('offer_id');
  const offerName = searchParams.get('offer_name');
  const offerUrlId = searchParams.get('offer_url_id'); // Base64 encoded URL

  // --- Initial validation ---
  if (!userId || !secretKey || !offerUrlId) {
    console.warn('CPAGrip Postback: Missing required parameters (sub1, sub2, offer_url_id).');
    return NextResponse.json({ status: 'error', message: 'Missing parameters' }, { status: 400 });
  }

  try {
    if (!database) {
      throw new Error("Firebase not initialized on server.");
    }
    
    const settingsRef = ref(database, 'globalSettings/cpaGripSettings');
    const settingsSnapshot = await get(settingsRef);
    if (!settingsSnapshot.exists()) {
      throw new Error("CPAGrip settings not found in database.");
    }
    const settings: GlobalSettings['cpaGripSettings'] = settingsSnapshot.val();
    const requiredCompletions = settings?.requiredCompletions || 1;

    if (secretKey !== settings?.postbackKey) {
      console.warn(`CPAGrip Postback: Invalid secret key. Received: ${secretKey}`);
      return NextResponse.json({ status: 'error', message: 'Invalid secret key' }, { status: 403 });
    }
    
    // --- Check if user has already completed this specific offer ---
    const completedOfferRef = ref(database, `users/${userId}/completedCpaOffers/${offerUrlId}`);
    const completedOfferSnapshot = await get(completedOfferRef);
    if (completedOfferSnapshot.exists()) {
        console.log(`CPAGrip Postback: User ${userId} has already completed offer ${offerUrlId}. Ignoring.`);
        return new Response('1', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    
    await set(completedOfferRef, true); // Mark this specific offer as completed

    // --- Update user's progress ---
    const userProgressRef = ref(database, `users/${userId}/cpaMilestoneProgress`);
    const progressSnapshot = await runTransaction(userProgressRef, (currentProgress: { count: number } | null) => {
        if (currentProgress) {
            currentProgress.count = (currentProgress.count || 0) + 1;
        } else {
            currentProgress = { count: 1 };
        }
        return currentProgress;
    });

    const newCount = progressSnapshot.snapshot.val()?.count || 1;
    
    // --- Check if milestone is reached ---
    if (newCount >= requiredCompletions) {
        console.log(`User ${userId} reached milestone of ${requiredCompletions}. Awarding points.`);
        
        const pointsToAward = settings.points || 0;
        if (pointsToAward <= 0) {
            console.log(`CPAGrip Postback: Reward points are 0 or not set for user ${userId}. Skipping award.`);
        } else {
            // Update wallet
            const userWalletRef = ref(database, `users/${userId}/wallet`);
            await runTransaction(userWalletRef, (currentBalance: number | null) => {
                return (currentBalance || 0) + pointsToAward;
            });
            // Log transaction
            const walletTxRef = ref(database, `walletTransactions/${userId}`);
            const newTransaction: Omit<WalletTransaction, 'id'> = {
                type: 'cpa_grip_reward',
                amount: pointsToAward,
                status: 'completed',
                date: new Date().toISOString(),
                description: `Reward for completing ${requiredCompletions} offers. Last offer: ${offerName || 'Unknown'}`,
            };
            await push(walletTxRef, newTransaction);
        }
        
        // Reset progress
        await set(userProgressRef, { count: 0 });

    } else {
        console.log(`User ${userId} progress updated to ${newCount}/${requiredCompletions}. No reward yet.`);
    }

    console.log(`CPAGrip Postback: Successfully processed offer ${offerUrlId} for user ${userId}.`);
    
    // CPAGrip expects '1' on success
    return new Response('1', { status: 200, headers: { 'Content-Type': 'text/plain' } });

  } catch (error: any) {
    console.error("CPAGrip Postback Error:", error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
