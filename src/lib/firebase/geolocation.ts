
import { headers } from 'next/headers';

const API_KEY = "3d4f6837039b40c18f104b96de8da46f";

export async function getGeolocationData(ip: string | null) {
  if (!ip) {
    console.log("No IP provided to getGeolocationData");
    return null;
  }
  
  // Prevent calling for local/private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
    console.log(`Skipping geolocation for local/private IP: ${ip}`);
    return null;
  }

  try {
    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${API_KEY}&ip=${ip}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Basic validation of the response
    if (!data.country_name) {
      return null;
    }

    return {
      ip: data.ip,
      country_name: data.country_name,
      city: data.city,
      country_flag: data.country_flag, // URL to the country flag image
      isp: data.isp,
    };
  } catch (error) {
    console.error("Error fetching geolocation data:", error);
    return null;
  }
}

// This function can now be called safely from Server Actions
export async function getClientIpAddress(): Promise<string | null> {
    try {
        const FALLBACK_IP_ADDRESS = '0.0.0.0'
        const forwardedFor = headers().get('x-forwarded-for')
    
        if (forwardedFor) {
          return forwardedFor.split(',')[0] ?? FALLBACK_IP_ADDRESS
        }
    
        return headers().get('x-real-ip') ?? FALLBACK_IP_ADDRESS
    } catch (error) {
        console.error("Error fetching client IP from headers:", error);
        return null;
    }
}
