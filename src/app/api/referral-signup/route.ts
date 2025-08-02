
import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin'; // Use the admin SDK
import type { User, WalletTransaction, GlobalSettings } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { newUserId, referralCode } = body;

        if (!newUserId || !referralCode) {
            return NextResponse.json({ message: 'Missing new user ID or referral code.' }, { status: 400 });
        }

        // 1. Fetch Global Settings using Admin SDK
        const settingsRef = adminDb.ref('globalSettings');
        const settingsSnapshot = await settingsRef.once('value');
        const settings: Partial<GlobalSettings> = settingsSnapshot.val() || {};

        if (!settings.shareAndEarnEnabled) {
            return NextResponse.json({ message: 'Referral system is currently disabled.' }, { status: 403 });
        }

        const bonusAmount = settings.referralBonusAmount || 0;
        if (bonusAmount <= 0) {
            return NextResponse.json({ message: 'Referral bonus is not configured.' }, { status: 200 });
        }

        // 2. Find the Referrer User
        const usersRef = adminDb.ref('users');
        const referrerQuery = usersRef.orderByChild('referralCode').equalTo(referralCode);
        const referrerSnapshot = await referrerQuery.once('value');

        if (!referrerSnapshot.exists()) {
            return NextResponse.json({ message: 'The referral code used is invalid or does not exist.' }, { status: 404 });
        }
        
        let referrerId = '';
        let referrerData: User | null = null;
        referrerSnapshot.forEach(child => {
            referrerId = child.key!;
            referrerData = child.val();
        });

        if (!referrerId || !referrerData) {
            return NextResponse.json({ message: 'Could not identify the referrer.' }, { status: 500 });
        }
        
        if (referrerId === newUserId) {
            return NextResponse.json({ message: 'Users cannot refer themselves.' }, { status: 400 });
        }
        
        // 3. Prepare database updates in a single transaction-like object
        const updates: Record<string, any> = {};
        const nowISO = new Date().toISOString();

        // Update New User's wallet and details
        updates[`/users/${newUserId}/wallet`] = bonusAmount;
        updates[`/users/${newUserId}/referralBonusReceived`] = bonusAmount;
        updates[`/users/${newUserId}/appliedReferralCode`] = referralCode; // Ensure this is set
        updates[`/users/${newUserId}/referredByDelegate`] = referrerData.role === 'delegate' ? referrerId : null;


        // Update Referrer's wallet and details
        updates[`/users/${referrerId}/wallet`] = (referrerData.wallet || 0) + bonusAmount;
        updates[`/users/${referrerId}/totalReferralCommissionsEarned`] = (referrerData.totalReferralCommissionsEarned || 0) + bonusAmount;

        // Log transaction for the New User
        const newUserTxKey = adminDb.ref(`walletTransactions/${newUserId}`).push().key;
        updates[`/walletTransactions/${newUserId}/${newUserTxKey}`] = {
            type: 'referral_bonus_received',
            amount: bonusAmount,
            status: 'completed',
            date: nowISO,
            description: `Signup bonus for using code ${referralCode} from ${referrerData.username}`
        } as Omit<WalletTransaction, 'id'>;

        // Log transaction for the Referrer
        const referrerTxKey = adminDb.ref(`walletTransactions/${referrerId}`).push().key;
        const newUserSnapshot = await adminDb.ref(`users/${newUserId}`).once('value');
        const newUsername = newUserSnapshot.val()?.username || 'a new user';

        updates[`/walletTransactions/${referrerId}/${referrerTxKey}`] = {
            type: 'referral_commission_earned',
            amount: bonusAmount,
            status: 'completed',
            date: nowISO,
            description: `Commission for referring ${newUsername}`
        } as Omit<WalletTransaction, 'id'>;
        
        // 4. Atomically apply all updates
        await adminDb.ref().update(updates);

        return NextResponse.json({ message: `A bonus of Rs ${bonusAmount} has been applied to your account!` }, { status: 200 });

    } catch (error: any) {
        console.error('API /referral-signup Error:', error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}
