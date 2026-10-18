import { useEffect, useState } from 'react';
import { searchPlaces, type PlaceSuggestion } from '../services/geocodingService';

// Wait for a short pause in typing so every keystroke does not hit the search service.
const DEBOUNCE_MS = 350;

/** Address suggestions for what the user is typing; empty until at least 3 characters. */
export function usePlaceSuggestions(query: string, near?: { latitude: number; longitude: number } | null) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const nearLat = near?.latitude;
  const nearLng = near?.longitude;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      const center = nearLat != null && nearLng != null ? { latitude: nearLat, longitude: nearLng } : null;
      searchPlaces(trimmed, center, 5, controller.signal)
        .then(setSuggestions)
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, nearLat, nearLng]);

  return { suggestions, loading };
}
