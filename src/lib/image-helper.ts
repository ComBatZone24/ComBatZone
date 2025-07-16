

export function getYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }
      if (parsedUrl.pathname.startsWith('/embed/')) {
        return parsedUrl.pathname.split('/embed/')[1].split('?')[0];
      }
       if (parsedUrl.pathname.startsWith('/live/')) {
        return parsedUrl.pathname.split('/live/')[1].split('?')[0];
      }
    }
    if (parsedUrl.hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1).split('?')[0];
    }
  } catch (e) {
    // Invalid URL or other parsing error
    // console.warn("Error parsing YouTube URL:", e);
  }
  return null;
}

export function getDisplayableBannerUrl(
  initialUrl?: string | null,
  gameName?: string
): string {
  const defaultGameName = gameName || 'Tournament';
  const placeholderUrlBase = `https://placehold.co/600x300.png`;
  const placeholderUrlWithGame = `${placeholderUrlBase}?text=${encodeURIComponent(defaultGameName)}`;
  
  if (!initialUrl || typeof initialUrl !== 'string' || initialUrl.trim() === '') {
    return placeholderUrlWithGame;
  }

  // Check for Google Drive share links
  if (initialUrl.includes('drive.google.com/file/d/')) {
    const match = initialUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      // This format attempts to get a direct viewable/downloadable version
      // IMPORTANT: The Google Drive file MUST be shared publicly for this to work.
 return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
  
  // Check for direct image URLs
  const imageExtensions = /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i;
  try {
    const testUrl = new URL(initialUrl); // Test if it's a valid URL first
    if (imageExtensions.test(testUrl.pathname)) {
        return initialUrl;
    }
  } catch (e) {
    // Not a valid URL, fall through
  }
  
  // Check for placehold.co URLs (already good)
  if (initialUrl.includes('placehold.co')) {
     try {
      new URL(initialUrl); // Validate it's a full URL
      return initialUrl;
    } catch (e) { /* fall through */ }
  }

  // Check for YouTube URLs
  const videoId = getYoutubeVideoId(initialUrl);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // Fallback for any other type of link
  return placeholderUrlWithGame;
}

export function generateDataAiHint(initialUrl?: string | null, gameName?: string): string {
  const defaultGameName = gameName || 'Tournament';
  const gameKeyword = (defaultGameName.match(/[a-zA-Z0-9]+/) || ['game'])[0].toLowerCase();

  if (!initialUrl || typeof initialUrl !== 'string' || initialUrl.trim() === '') {
    return `${gameKeyword} banner`;
  }
  
  if (initialUrl.includes('drive.google.com/file/d/')) {
    return `drive ${gameKeyword}`; 
  }
  
  if (initialUrl.includes('placehold.co')) {
     return `${gameKeyword} placeholder`;
  }
  
  const imageExtensions = /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i;
   try {
    const testUrl = new URL(initialUrl);
    if (imageExtensions.test(testUrl.pathname)) {
        return `${gameKeyword} image`;
    }
  } catch (e) { /* fall through */ }
  
  const videoId = getYoutubeVideoId(initialUrl);
  if (videoId) {
    return `${gameKeyword} video`;
  }

  return `${gameKeyword} event`;
}

/**
 * Converts a standard Google Drive file sharing link into a direct download link.
 * This is useful for forcing a download of files like APKs instead of showing a preview page.
 * @param googleDriveUrl The standard sharing URL from Google Drive (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
 * @returns A direct download link or the original URL if it's not a valid Google Drive link.
 */
export function createDirectGoogleDriveDownloadLink(googleDriveUrl?: string | null): string {
  if (!googleDriveUrl || !googleDriveUrl.includes('drive.google.com/file/d/')) {
    return googleDriveUrl || '';
  }

  const match = googleDriveUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // Fallback to the original URL if the format is unexpected
  return googleDriveUrl;
}
