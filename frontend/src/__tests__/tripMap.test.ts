import { buildTripMap, driverPosition } from '../screens/home/tripMap';
import type { BookingData } from '../types';

const booking = {
  _id: 'b1',
  customerId: 'c1',
  pickupAddress: 'Pickup',
  dropAddress: 'Drop',
  pickupLocation: { type: 'Point', coordinates: [77.6, 12.97] },
  dropLocation: { type: 'Point', coordinates: [77.64, 12.98] },
  serviceTier: 'uberx',
  status: 'DRIVER_ACCEPTED',
  fare: 150,
  createdAt: '2026-10-10T00:00:00Z',
} as BookingData;

describe('trip map', () => {
  it('shows nothing without a trip', () => {
    expect(buildTripMap(null, null, null).markers).toHaveLength(0);
  });

  it('shows pickup and drop-off, and the driver only when a position is known', () => {
    expect(buildTripMap(booking, null, null).markers.map((m) => m.id)).toEqual(['pickup', 'drop']);
    const withDriver = buildTripMap(booking, { latitude: 12.96, longitude: 77.59 }, null);
    expect(withDriver.markers.map((m) => m.id)).toContain('driver-assigned');
  });

  it('draws a route line only from a real route', () => {
    expect(buildTripMap(booking, null, null).polyline).toBeUndefined();
    const route = { coordinates: [[77.6, 12.97], [77.64, 12.98]] as [number, number][], distanceKm: 4, durationMins: 9, summary: '', steps: [] };
    expect(buildTripMap(booking, null, route).polyline?.coordinates).toHaveLength(2);
  });

  it('prefers the live driver position over the stored one', () => {
    const stored = { ...booking, driverLocation: { latitude: 1, longitude: 2, updatedAt: '' } };
    expect(driverPosition(stored, { latitude: 3, longitude: 4 })).toEqual({ latitude: 3, longitude: 4 });
    expect(driverPosition(stored, null)).toMatchObject({ latitude: 1, longitude: 2 });
    expect(driverPosition(booking, null)).toBeNull();
  });
});
