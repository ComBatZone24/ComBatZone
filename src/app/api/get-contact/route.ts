// This API endpoint is no longer needed because the logic has been moved
// to the wallet component for handling referral bonuses on first visit.
// This file can be safely deleted.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated and no longer in use.' },
    { status: 410 } // 410 Gone
  );
}
