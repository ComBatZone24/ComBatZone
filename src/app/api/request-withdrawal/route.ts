import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { User as AppUserType, WalletTransaction, WithdrawRequest } from '@/types';

const MIN_WITHDRAWAL_AMOUNT = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, amount, method, accountNumber, accountName } = body;

    // 1. Basic Input Validation
    if (!userId || !username || !amount || !method || !accountNumber || !accountName) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json({ message: `Minimum withdrawal amount is Rs ${MIN_WITHDRAWAL_AMOUNT}.` }, { status: 400 });
    }

    // 2. Fetch User Data & Verify Balance
    const userRef = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');
    if (!userSnapshot.exists()) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const userData: AppUserType = userSnapshot.val();
    const userWalletBalance = Number(userData.wallet || 0);

    if (userWalletBalance < withdrawalAmount) {
      return NextResponse.json({ message: 'Insufficient wallet balance.' }, { status: 400 });
    }

    // 3. Atomically Update Wallet (Hold Funds)
    const holdTransactionId = adminDb.ref(`walletTransactions/${userId}`).push().key;
    if (!holdTransactionId) {
      throw new Error("Could not generate a transaction key.");
    }
    
    // Create the withdrawal request key first
    const withdrawRequestKey = adminDb.ref('withdrawRequests').push().key;
    if (!withdrawRequestKey) {
        throw new Error("Could not generate a withdrawal request key.");
    }

    // We will perform a multi-path update to ensure atomicity
    const updates: Record<string, any> = {};

    // a) Deduct from wallet
    updates[`/users/${userId}/wallet`] = userWalletBalance - withdrawalAmount;
    
    // b) Create the 'on_hold' transaction data WITH the relatedRequestId already inside it
    const holdTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'shop_purchase_hold', // Reusing this type for hold logic
        amount: -withdrawalAmount,
        status: 'on_hold',
        date: new Date().toISOString(),
        description: `Hold for Withdrawal Request to ${method}`,
        relatedRequestId: withdrawRequestKey // Link the request ID here
    };
    // Add the entire transaction object to the updates
    updates[`/walletTransactions/${userId}/${holdTransactionId}`] = holdTransactionData;

    // c) Create the withdrawal request data
    const newRequestData: Omit<WithdrawRequest, 'id'> = {
        uid: userId,
        username: username,
        amount: withdrawalAmount,
        method,
        accountNumber,
        accountName,
        status: "pending",
        requestDate: new Date().toISOString(),
        walletTransactionId: holdTransactionId,
      };
    updates[`/withdrawRequests/${withdrawRequestKey}`] = newRequestData;
    
    // 4. Execute all updates at once
    await adminDb.ref().update(updates);

    return NextResponse.json({ message: 'Withdrawal request submitted successfully.', requestId: withdrawRequestKey }, { status: 200 });

  } catch (error: any) {
    console.error("API /request-withdrawal Error:", error);
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
