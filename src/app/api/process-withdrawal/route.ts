
import { NextRequest, NextResponse } from 'next/server';
import admin, { adminDb } from '@/lib/firebase/admin';
import type { WithdrawRequest, User as AppUserType, WalletTransaction, GlobalSettings } from '@/types';

async function getFeeRecipientId(request: WithdrawRequest, adminFeeWalletUid: string | null): Promise<string | null> {
    try {
        const userRef = adminDb.ref(`users/${request.uid}`);
        const userSnapshot = await userRef.once('value');
        if (!userSnapshot.exists()) return adminFeeWalletUid;

        const userData: AppUserType = userSnapshot.val();
        const appliedCode = userData.appliedReferralCode;

        if (appliedCode) {
            const delegatesRef = adminDb.ref('users').orderByChild('referralCode').equalTo(appliedCode);
            const delegateSnapshot = await delegatesRef.once('value');
            if (delegateSnapshot.exists()) {
                const delegateData = delegateSnapshot.val();
                const delegateId = Object.keys(delegateData)[0];
                if (delegateData[delegateId]?.role === 'delegate') {
                    return delegateId;
                }
            }
        }
        return adminFeeWalletUid;
    } catch (error) {
        console.error("Error determining fee recipient, defaulting to admin:", error);
        return adminFeeWalletUid;
    }
}

async function handleApproval(requestId: string, adminFeeWalletUid: string | null) {
    const requestRef = adminDb.ref(`withdrawRequests/${requestId}`);
    const requestSnapshot = await requestRef.once('value');
    if (!requestSnapshot.exists()) {
        throw new Error("Withdrawal request not found.");
    }

    const requestToUpdate: WithdrawRequest = { id: requestId, ...requestSnapshot.val() };
    if (requestToUpdate.status !== 'pending') {
        throw new Error("This request has already been processed.");
    }
    const { uid: userId, amount, walletTransactionId } = requestToUpdate;
    if (!userId || !walletTransactionId) {
        throw new Error("Request is missing user ID or original transaction link.");
    }

    const updates: Record<string, any> = {};
    updates[`/withdrawRequests/${requestId}/status`] = 'completed';
    updates[`/withdrawRequests/${requestId}/processedDate`] = new Date().toISOString();
    updates[`/walletTransactions/${userId}/${walletTransactionId}/status`] = 'completed';
    updates[`/walletTransactions/${userId}/${walletTransactionId}/description`] = `Withdrawal to ${requestToUpdate.method || 'account'} completed.`;
    
    const feeRecipientId = await getFeeRecipientId(requestToUpdate, adminFeeWalletUid);
    const feeAmount = requestToUpdate.amount * 0.05;

    if (feeRecipientId && feeAmount > 0) {
        const recipientWalletRef = adminDb.ref(`users/${feeRecipientId}/wallet`);
        const recipientTxRef = adminDb.ref(`walletTransactions/${feeRecipientId}`);
        await recipientWalletRef.set(admin.database.ServerValue.increment(feeAmount));

        const commissionTx: Omit<WalletTransaction, 'id'> = {
            type: 'referral_commission_earned',
            amount: feeAmount,
            status: 'completed',
            date: new Date().toISOString(),
            description: `5% fee from ${requestToUpdate.username}'s withdrawal of Rs ${requestToUpdate.amount.toFixed(2)}`
        };
        await recipientTxRef.push(commissionTx);
    }
    
    await adminDb.ref().update(updates);

    return { title: "Request Approved", message: `Withdrawal for Rs ${amount.toFixed(2)} finalized.` };
}


async function handleRejection(requestId: string) {
    const requestRef = adminDb.ref(`withdrawRequests/${requestId}`);
    const requestSnapshot = await requestRef.once('value');
    if (!requestSnapshot.exists()) {
        throw new Error("Withdrawal request not found.");
    }

    const requestToUpdate: WithdrawRequest = { id: requestId, ...requestSnapshot.val() };
    if (requestToUpdate.status !== 'pending') {
        throw new Error("This request has already been processed.");
    }
    const { uid: userId, amount, walletTransactionId } = requestToUpdate;
    if (!userId || !walletTransactionId) {
        throw new Error("Request is missing user ID or original transaction link.");
    }

    const updates: Record<string, any> = {};
    updates[`/withdrawRequests/${requestId}/status`] = 'rejected';
    updates[`/withdrawRequests/${requestId}/processedDate`] = new Date().toISOString();
    updates[`/walletTransactions/${userId}/${walletTransactionId}/status`] = 'rejected';
    updates[`/walletTransactions/${userId}/${walletTransactionId}/description`] = 'Withdrawal request rejected.';
    
    const userWalletRef = adminDb.ref(`users/${userId}/wallet`);
    await userWalletRef.set(admin.database.ServerValue.increment(amount));
    
    const refundTransactionData: Omit<WalletTransaction, 'id'> = {
        type: 'refund',
        amount: amount,
        status: 'completed',
        date: new Date().toISOString(),
        description: `Withdrawal request (ID: ${requestId.substring(0, 6)}...) rejected - amount refunded.`,
        relatedRequestId: requestId
    };
    await adminDb.ref(`walletTransactions/${userId}`).push(refundTransactionData);

    await adminDb.ref().update(updates);
    
    return { title: "Request Rejected & Refunded", message: `Request rejected. Rs ${amount.toFixed(2)} refunded to user.` };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, requestId } = body;

        const settingsSnap = await adminDb.ref('globalSettings/tokenSettings/adminFeeWalletUid').once('value');
        const adminFeeWalletUid = settingsSnap.val() || null;

        if (action === 'get_recipient') {
            const requestRef = adminDb.ref(`withdrawRequests/${requestId}`);
            const requestSnapshot = await requestRef.once('value');
            if (!requestSnapshot.exists()) throw new Error("Request not found.");
            
            const recipientId = await getFeeRecipientId(requestSnapshot.val(), adminFeeWalletUid);
            if (recipientId) {
                const recipientSnapshot = await adminDb.ref(`users/${recipientId}`).once('value');
                if (recipientSnapshot.exists()) {
                    return NextResponse.json({ recipient: { id: recipientId, ...recipientSnapshot.val() } });
                }
            }
            return NextResponse.json({ recipient: null }); // Default to admin if no specific delegate
        }
        
        let result;
        if (action === 'approved') {
            result = await handleApproval(requestId, adminFeeWalletUid);
        } else if (action === 'rejected') {
            result = await handleRejection(requestId);
        } else {
            throw new Error("Invalid action specified.");
        }

        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("API /process-withdrawal Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}
