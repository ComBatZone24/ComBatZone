
import { NextResponse } from 'next/server';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import type { GlobalSettings } from '@/types';

// Helper function to process the logo URL from settings
function getPwaIconUrl(initialUrl?: string | null): string {
  const placeholderUrl = 'https://placehold.co/512x512.png?text=C'; // Updated placeholder text
  if (!initialUrl || typeof initialUrl !== 'string' || initialUrl.trim() === '') {
    return placeholderUrl;
  }
  // Handle Google Drive links
  if (initialUrl.includes('drive.google.com/file/d/')) {
    const match = initialUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  // Assume it's a direct, valid URL
  try {
    new URL(initialUrl);
    return initialUrl;
  } catch (e) {
    return placeholderUrl;
  }
}

export async function GET() {
  let settings: Partial<GlobalSettings> = {};
  
  if (database) {
    try {
      const settingsRef = ref(database, 'globalSettings');
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        settings = snapshot.val();
      }
    } catch (error) {
      console.error("Failed to fetch settings for manifest.webmanifest:", error);
    }
  }

  const appName = settings.appName || 'ComBatZone';
  const appDescription = `Join ${appName} for eSports tournaments in Pakistan, win prizes, and earn money.`;
  const pwaIcon = getPwaIconUrl(settings.appLogoUrl);

  const manifest = {
    name: appName,
    short_name: appName,
    description: appDescription,
    icons: [
      {
        src: pwaIcon,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: pwaIcon,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    start_url: '/',
    display: 'standalone',
    background_color: '#0e1117', // Match --background hsl(210, 15%, 10%)
    theme_color: '#5b21b6', // Match --accent hsl(274, 100%, 55%) as a close hex
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  });
}
