/**
 * Geocoding Service using OpenStreetMap Nominatim API
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export async function geocodeAddress(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return null;

  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=json&limit=1&addressdetails=1`;

    // If user location is known, add viewbox bias around ~50km
    if (userLocation) {
      const delta = 0.5;
      const left = userLocation.longitude - delta;
      const right = userLocation.longitude + delta;
      const top = userLocation.latitude + delta;
      const bottom = userLocation.latitude - delta;
      url += `&viewbox=${left},${top},${right},${bottom}`;
    }

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BlackSquad-RideApp/1.0',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return {
          latitude: lat,
          longitude: lon,
          displayName: first.display_name,
        };
      }
    }
    return null;
  } catch (error) {
    console.warn('Geocoding lookup failed:', error);
    return null;
  }
}
