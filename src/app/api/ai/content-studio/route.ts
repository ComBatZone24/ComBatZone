// This API route is no longer necessary as the client-side component now directly invokes the server action.
// This simplifies the architecture and removes a network layer.
// This file can be safely deleted.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Please use the server action directly.' },
    { status: 410 } // 410 Gone
  );
}
