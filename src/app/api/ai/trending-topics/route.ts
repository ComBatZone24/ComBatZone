
import { NextRequest, NextResponse } from 'next/server';
import { getTrendingTopics } from '@/ai/flows/get-trending-topics-flow';
import type { TrendingTopicsInput } from '@/ai/flows/get-trending-topics-flow';

export async function POST(request: NextRequest) {
  try {
    const body: TrendingTopicsInput = await request.json();
    const { platform } = body;

    if (!platform) {
      return NextResponse.json({ message: 'Platform is required.' }, { status: 400 });
    }

    const topics = await getTrendingTopics({ platform });

    return NextResponse.json(topics, { status: 200 });
  } catch (error: any) {
    console.error("API /ai/trending-topics Error:", error);
    return NextResponse.json(
      { message: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
