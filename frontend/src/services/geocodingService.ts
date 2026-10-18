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

export interface PlaceSuggestion {
  /** Short name, e.g. "Indiranagar". */
  title: string;
  /** The rest of the address, for telling similar places apart. */
  subtitle: string;
  /** Full address used for the booking. */
  address: string;
  /** [longitude, latitude] */
  coordinates: [number, number];
}

/** Up to `limit` places matching what the user has typed, nearest to them first when their location is known. */
export async function searchPlaces(
  query: string,
  near?: { latitude: number; longitude: number } | null,
  limit = 5,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=${limit}&addressdetails=1&countrycodes=in`;
  if (near) {
    const d = 0.5;
    url += `&viewbox=${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`;
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) return [];
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string; name?: string }[];
  return rows
    .map((row) => {
      const parts = row.display_name.split(',').map((p) => p.trim());
      const title = row.name || parts[0] || row.display_name;
      const subtitle = parts.filter((p) => p !== title).slice(0, 3).join(', ');
      return {
        title,
        subtitle,
        address: [title, subtitle].filter(Boolean).join(', '),
        coordinates: [parseFloat(row.lon), parseFloat(row.lat)] as [number, number],
      };
    })
    .filter((p) => Number.isFinite(p.coordinates[0]) && Number.isFinite(p.coordinates[1]));
}
