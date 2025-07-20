
import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/firebase/config';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import type { User, GlobalSettings } from '@/types';

// This API route securely fetches the correct contact number (delegate or admin)
// for a user trying to top-up their wallet.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode } = body;

    if (!database) {
        throw new Error("Database service is not available.");
    }
    
    // 1. Fetch Admin's WhatsApp number as a fallback.
    const settingsRef = ref(database, 'globalSettings/contactWhatsapp');
    const settingsSnapshot = await get(settingsRef);
    const adminNumbers = (settingsSnapshot.exists() ? settingsSnapshot.val() : []) as string[];
    
    if (!adminNumbers || adminNumbers.length === 0) {
        throw new Error("Admin contact information is not configured.");
    }
    const adminContactNumber = adminNumbers[Math.floor(Math.random() * adminNumbers.length)];

    // 2. If no referral code is provided by the user, return the admin's number.
    if (!referralCode || typeof referralCode !== 'string' || referralCode.trim() === '') {
      return NextResponse.json({ contactNumber: adminContactNumber });
    }

    // 3. If a referral code exists, find the referring delegate.
    const usersRef = ref(database, 'users');
    const referrerQuery = query(usersRef, orderByChild('referralCode'), equalTo(referralCode.trim().toUpperCase()));
    const referrerSnapshot = await get(referrerQuery);

    if (!referrerSnapshot.exists()) {
        // If the code is invalid, fallback to admin.
        return NextResponse.json({ contactNumber: adminContactNumber });
    }

    let delegateContactNumber: string | null = null;
    referrerSnapshot.forEach(childSnapshot => {
        const referrer = childSnapshot.val() as User;
        // Check if the referrer is an active delegate and has a number.
        if (referrer.role === 'delegate' && referrer.isActive) {
            // Prioritize the dedicated WhatsApp number, then fallback to the regular phone.
            delegateContactNumber = referrer.whatsappNumber || referrer.phone || null;
        }
    });

    // 4. Return the delegate's number if found, otherwise fallback to admin.
    if (delegateContactNumber) {
        return NextResponse.json({ contactNumber: delegateContactNumber });
    } else {
        return NextResponse.json({ contactNumber: adminContactNumber });
    }

  } catch (error: any) {
    console.error("API Error in /api/get-contact:", error.message);
    // Return a generic error message to the client
    return NextResponse.json({ message: "Could not retrieve contact information. Please try again later." }, { status: 500 });
  }
}
