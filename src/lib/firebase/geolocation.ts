
import { headers } from 'next/headers';

const API_KEY = "3d4f6837039b40c18f104b96de8da46f";

export async function getClientIpAddress(): Promise<string | null> {
    try {
        const headersList = headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() || null;
        return ip;
    } catch (error) {
        console.warn("Could not read headers to determine IP. This is expected in some environments (e.g., local dev).");
        return null;
    }
}

export async function getGeolocationData(ip: string | null) {
  if (!ip) {
      console.log("No IP address provided, skipping geolocation fetch.");
      return null;
  }
  
  try {
    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${API_KEY}&ip=${ip}`);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Geolocation API error (${response.status}):`, errorText);
        return null;
    }
    
    const data = await response.json();
    
    return {
      ip: data.ip,
      country_name: data.country_name,
      city: data.city,
      country_flag: data.country_flag,
      isp: data.isp,
    };
  } catch (error) {
    console.error('Failed to fetch geolocation data:', error);
    return null;
  }
}
