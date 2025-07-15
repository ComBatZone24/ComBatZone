
const API_KEY = "3d4f6837039b40c18f104b96de8da46f";

export async function getGeolocationData(ip: string | null) {
  if (!ip) {
    console.log("No IP provided to getGeolocationData");
    return null;
  }
  
  // Prevent calling for local/private IPs
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.log(`Skipping geolocation for local IP: ${ip}`);
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

export async function getClientIpAddress(): Promise<string | null> {
    try {
        // We use ipify as a simple, reliable public IP address provider.
        const response = await fetch('https://api.ipify.org?format=json', {
            cache: 'no-store', // Ensure we always get the live IP, bypass browser cache
        });
        if (!response.ok) {
            throw new Error(`ipify API request failed with status ${response.status}`);
        }
        const data = await response.json();
        return data.ip || null;
    } catch (error) {
        console.error("Error fetching client IP address:", error);
        return null; // Return null on failure
    }
}
