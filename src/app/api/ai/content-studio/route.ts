
import { NextRequest, NextResponse } from 'next/server';
import { generateSocialContent } from '@/ai/flows/generate-social-content-flow';
import type { GenerateSocialContentInput } from '@/ai/flows/generate-social-content-flow';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSocialContentInput = await request.json();
    const { platform, topic } = body;

    if (!platform || !topic) {
      return NextResponse.json({ message: 'Platform and topic are required.' }, { status: 400 });
    }

    const content = await generateSocialContent({ platform, topic });

    return NextResponse.json(content, { status: 200 });
  } catch (error: any) {
    console.error("API /ai/content-studio Error:", error);
    return NextResponse.json(
      { message: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
