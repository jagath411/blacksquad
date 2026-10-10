import { useEffect, useRef, useState } from 'react';
import { getRoadRoute, type RoadRouteResult } from '../services/routingService';
import { calculateDistanceMeters } from '../utils/geo';
import type { BookingData } from '../types';

// Re-route only after the driver has moved this far, so GPS updates every few seconds
// do not each trigger a routing request.
const REROUTE_AFTER_METERS = 150;

type LngLat = [number, number];

/** Where the trip is heading now: the pickup before the trip starts, the drop-off after. */
function routeEnds(booking: BookingData, driver: LngLat | null): { from: LngLat; to: LngLat } | null {
  const pickup = booking.pickupLocation?.coordinates;
  const drop = booking.dropLocation?.coordinates;
  if (!pickup || !drop) return null;
  if (booking.status === 'TRIP_STARTED') return { from: driver ?? pickup, to: drop };
  if (booking.status === 'DRIVER_ACCEPTED' || booking.status === 'DRIVER_ARRIVING') {
    return driver ? { from: driver, to: pickup } : { from: pickup, to: drop };
  }
  return { from: pickup, to: drop };
}

export function useRoadRoute(booking: BookingData | null, driver: LngLat | null) {
  const [route, setRoute] = useState<RoadRouteResult | null>(null);
  const lastOrigin = useRef<{ key: string; from: LngLat } | null>(null);

  const ends = booking ? routeEnds(booking, driver) : null;
  const legKey = booking ? `${booking._id}:${booking.status}` : '';

  useEffect(() => {
    if (!ends) {
      lastOrigin.current = null;
      setRoute(null);
      return;
    }
    const previous = lastOrigin.current;
    const sameLeg = previous?.key === legKey;
    if (sameLeg && calculateDistanceMeters(previous.from, ends.from) < REROUTE_AFTER_METERS) return;

    lastOrigin.current = { key: legKey, from: ends.from };
    let cancelled = false;
    getRoadRoute(ends.from, ends.to)
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // ends is derived from these values; listing them keeps the effect from running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey, ends?.from[0], ends?.from[1], ends?.to[0], ends?.to[1]]);

  return route;
}
