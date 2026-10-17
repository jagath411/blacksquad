import type { MapMarker, RoutePolyline } from '../../components/MapView';
import type { RoadRouteResult } from '../../services/routingService';
import type { BookingData } from '../../types';

/** Pickup, drop-off and driver markers for a trip, plus the route line when one is known. */
export function buildTripMap(
  booking: BookingData | null,
  driver: { latitude: number; longitude: number; heading?: number } | null,
  route: RoadRouteResult | null,
): { markers: MapMarker[]; polyline?: RoutePolyline } {
  const markers: MapMarker[] = [];
  if (!booking) return { markers };

  const pickup = booking.pickupLocation?.coordinates;
  const drop = booking.dropLocation?.coordinates;
  if (pickup) {
    markers.push({ id: 'pickup', longitude: pickup[0], latitude: pickup[1], title: `Pickup: ${booking.pickupAddress}`, color: '#1D232B' });
  }
  if (drop) {
    markers.push({ id: 'drop', longitude: drop[0], latitude: drop[1], title: `Destination: ${booking.dropAddress}`, color: '#C8372D' });
  }
  if (driver) {
    markers.push({
      id: 'driver-assigned',
      latitude: driver.latitude,
      longitude: driver.longitude,
      heading: driver.heading ?? 0,
      title: 'Your driver',
      color: '#1D232B',
      isVehicle: true,
    });
  }

  const polyline =
    route && route.coordinates.length > 1
      ? { coordinates: route.coordinates, color: '#2457D6' }
      : undefined;
  return { markers, polyline };
}

/** The driver's last known position for a trip: live socket data first, then what the server stored. */
export function driverPosition(
  booking: BookingData | null,
  live: { latitude: number; longitude: number; heading?: number } | null,
): { latitude: number; longitude: number; heading?: number } | null {
  if (live) return live;
  const stored = booking?.driverLocation;
  return stored ? { latitude: stored.latitude, longitude: stored.longitude, heading: stored.heading } : null;
}
