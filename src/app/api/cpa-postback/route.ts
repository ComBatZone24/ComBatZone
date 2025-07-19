
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
  const offerUrlId = searchParams.get('offer_url_id'); // New parameter for identifying the specific URL

  // --- Initial validation ---
  if (!userId || !secretKey || !payoutStr || !offerUrlId) {
    console.warn('CPAGrip Postback: Missing required parameters (sub1, sub2, payout, offer_url_id).');
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

    if (secretKey !== settings?.postbackKey) {
      console.warn(`CPAGrip Postback: Invalid secret key. Received: ${secretKey}`);
      return NextResponse.json({ status: 'error', message: 'Invalid secret key' }, { status: 403 });
    }
    
    const pointsToAward = settings.points || 0;
    if (pointsToAward <= 0) {
      console.log(`CPAGrip Postback: Reward points are 0 or not set for user ${userId}. Skipping award.`);
      return NextResponse.json({ status: 'ok', message: 'No reward configured.' });
    }

    // --- Check if user has already completed this specific offer ---
    const completedOfferRef = ref(database, `users/${userId}/completedCpaOffers/${offerUrlId}`);
    const completedOfferSnapshot = await get(completedOfferRef);
    if (completedOfferSnapshot.exists()) {
        console.log(`CPAGrip Postback: User ${userId} has already completed offer ${offerUrlId}. Ignoring.`);
        return new Response('1', { status: 200, headers: { 'Content-Type': 'text/plain' } }); // Still return success to CPAGrip
    }

    // --- Update user's wallet ---
    const userWalletRef = ref(database, `users/${userId}/wallet`);
    const txResult = await runTransaction(userWalletRef, (currentBalance: number | null) => {
      return (currentBalance || 0) + pointsToAward;
    });

    if (!txResult.committed) {
      throw new Error(`Failed to update wallet for user ${userId}. Transaction did not commit.`);
    }

    // --- Mark this specific offer as completed for the user ---
    await set(completedOfferRef, true);

    // --- Log the transaction ---
    const walletTxRef = ref(database, `walletTransactions/${userId}`);
    const newTransaction: Omit<WalletTransaction, 'id'> = {
      type: 'cpa_grip_reward',
      amount: pointsToAward,
      status: 'completed',
      date: new Date().toISOString(),
      description: `Reward for completing CPAGrip offer: ${offerName || 'Unknown Offer'} (ID: ${offerId || 'N/A'})`,
    };
    await push(walletTxRef, newTransaction);
    
    console.log(`CPAGrip Postback: Successfully awarded ${pointsToAward} points to user ${userId} for completing offer ${offerUrlId}.`);
    
    // CPAGrip expects '1' on success
    return new Response('1', { status: 200, headers: { 'Content-Type': 'text/plain' } });

  } catch (error: any) {
    console.error("CPAGrip Postback Error:", error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
