import { DriverLocationModel } from '../models/DriverLocation';
import { DriverModel } from '../models/Driver';
import { BookingModel } from '../models/Booking';

type UserSummary = { name?: string; email?: string; _id?: { toString(): string } };

export interface DriverLocation {
  driverId: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  receivedAt: string;
  sequence: number;
}

export type LocationUpdateResult =
  | {
      accepted: true;
      location: DriverLocation;
      ownerId?: string;
      activeBookingId?: string;
      etaMinutes?: number;
      distanceKm?: number;
    }
  | { accepted: false; reason: 'stale' | 'driver_not_found' };

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Calculates estimated arrival time in minutes assuming average city speed of 30 km/h
 */
export function calculateEtaMinutes(distanceKm: number, averageSpeedKmh: number = 30): number {
  if (distanceKm <= 0.05) return 1;
  const minutes = Math.ceil((distanceKm / averageSpeedKmh) * 60);
  return Math.max(1, minutes);
}

// Each GPS fix updates live state and is broadcast at once. Database writes are spaced out:
// a few seconds of positions add nothing to the stored trail and cost a write each.
const PERSIST_INTERVAL_MS = 15_000;
const PERSIST_DISTANCE_KM = 0.05;
// How long a cached driver profile (id, owner, name) is trusted before re-reading it.
const DRIVER_CACHE_MS = 60_000;
// How often to re-check the database for the driver's current trip.
const TRIP_LOOKUP_MS = 30_000;

interface CachedDriver {
  driverDocId: string;
  ownerId?: string;
  driverName: string;
  loadedAt: number;
}

interface CachedTrip {
  bookingId: string | null;
  status?: string;
  target?: [number, number];
  checkedAt: number;
}

class LocationStateService {
  private readonly locations = new Map<string, DriverLocation>();
  private readonly sequences = new Map<string, number>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly drivers = new Map<string, CachedDriver>();
  private readonly trips = new Map<string, CachedTrip>();
  private readonly lastPersisted = new Map<string, { at: number; latitude: number; longitude: number }>();

  /** Called when a trip starts or ends so the next fix uses the right trip without a lookup. */
  public setActiveBooking(driverUserId: string, bookingId: string | null): void {
    this.trips.delete(driverUserId);
    if (bookingId) this.trips.set(driverUserId, { bookingId, checkedAt: 0 });
  }

  public getActiveBooking(driverUserId: string): string | undefined {
    return this.trips.get(driverUserId)?.bookingId ?? undefined;
  }

  private async loadDriver(driverUserId: string, fallbackName?: string): Promise<CachedDriver | null> {
    const cached = this.drivers.get(driverUserId);
    if (cached && Date.now() - cached.loadedAt < DRIVER_CACHE_MS) return cached;
    const driver = await DriverModel.findOne({ userId: driverUserId })
      .populate('userId', 'name email')
      .select('_id userId ownerId')
      .lean();
    if (!driver) return null;
    const userDoc = driver.userId as unknown as UserSummary;
    const entry: CachedDriver = {
      driverDocId: driver._id.toString(),
      ownerId: driver.ownerId?.toString(),
      driverName: userDoc?.name || userDoc?.email || fallbackName || 'Driver',
      loadedAt: Date.now(),
    };
    this.drivers.set(driverUserId, entry);
    return entry;
  }

  private async loadTrip(driverUserId: string, driverDocId: string): Promise<CachedTrip> {
    const cached = this.trips.get(driverUserId);
    if (cached && cached.target && Date.now() - cached.checkedAt < TRIP_LOOKUP_MS) return cached;
    const trip = await BookingModel.findOne({
      driverId: driverDocId,
      status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
    })
      .select('_id status pickupLocation dropLocation')
      .lean();
    const entry: CachedTrip = trip
      ? {
          bookingId: trip._id.toString(),
          status: trip.status,
          target: (trip.status === 'TRIP_STARTED' ? trip.dropLocation : trip.pickupLocation).coordinates,
          checkedAt: Date.now(),
        }
      : { bookingId: null, checkedAt: Date.now() };
    this.trips.set(driverUserId, entry);
    return entry;
  }

  private shouldPersist(driverUserId: string, input: { latitude: number; longitude: number }, now: number): boolean {
    const last = this.lastPersisted.get(driverUserId);
    if (!last) return true;
    if (now - last.at >= PERSIST_INTERVAL_MS) return true;
    return calculateDistanceKm(last.latitude, last.longitude, input.latitude, input.longitude) >= PERSIST_DISTANCE_KM;
  }

  public async update(
    input: Omit<DriverLocation, 'receivedAt' | 'sequence'>,
  ): Promise<LocationUpdateResult> {
    const previousLock = this.locks.get(input.driverId) ?? Promise.resolve();
    let resolveLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    const chain = previousLock.then(() => currentLock);
    this.locks.set(input.driverId, chain);
    await previousLock;

    try {
      const driver = await this.loadDriver(input.driverId, input.driverName);
      if (!driver) return { accepted: false, reason: 'driver_not_found' };

      const previous = this.locations.get(input.driverId);
      if (previous && input.timestamp < previous.timestamp) {
        return { accepted: false, reason: 'stale' };
      }

      const sequence = (this.sequences.get(input.driverId) ?? 0) + 1;
      const location: DriverLocation = {
        ...input,
        driverName: driver.driverName,
        sequence,
        receivedAt: new Date().toISOString(),
      };
      this.sequences.set(input.driverId, sequence);
      this.locations.set(input.driverId, location);

      const trip = await this.loadTrip(input.driverId, driver.driverDocId);
      let etaMinutes: number | undefined;
      let distanceKm: number | undefined;
      if (trip.bookingId && trip.target) {
        distanceKm = calculateDistanceKm(input.latitude, input.longitude, trip.target[1], trip.target[0]);
        // Device speed is metres per second; the ETA needs km/h.
        const speedKmh = input.speed ? input.speed * 3.6 : 0;
        etaMinutes = calculateEtaMinutes(distanceKm, speedKmh > 5 ? speedKmh : 30);
      }

      const now = Date.now();
      if (this.shouldPersist(input.driverId, input, now)) {
        this.lastPersisted.set(input.driverId, { at: now, latitude: input.latitude, longitude: input.longitude });
        const point = { type: 'Point' as const, coordinates: [input.longitude, input.latitude] as [number, number] };
        await Promise.all([
          DriverLocationModel.create({
            driverId: driver.driverDocId,
            location: point,
            speed: input.speed,
            heading: input.heading,
            accuracy: input.accuracy,
            timestamp: new Date(input.timestamp),
          }),
          DriverModel.updateOne(
            { _id: driver.driverDocId },
            { $set: { currentLocation: point, lastLocationUpdate: new Date(input.timestamp) } },
          ),
          trip.bookingId
            ? BookingModel.updateOne(
                { _id: trip.bookingId },
                {
                  $set: {
                    driverLocation: {
                      latitude: input.latitude,
                      longitude: input.longitude,
                      heading: input.heading,
                      speed: input.speed,
                      updatedAt: new Date(),
                    },
                  },
                },
              )
            : Promise.resolve(),
        ]);
      }

      return {
        accepted: true,
        location,
        ownerId: driver.ownerId,
        activeBookingId: trip.bookingId ?? undefined,
        etaMinutes,
        distanceKm,
      };
    } finally {
      resolveLock();
      if (this.locks.get(input.driverId) === chain) this.locks.delete(input.driverId);
    }
  }

  public async loadFromDatabase(): Promise<void> {
    const latest = await DriverLocationModel.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$driverId', location: { $first: '$$ROOT' } } },
    ]);
    for (const row of latest as Array<{
      _id: { toString(): string };
      location: {
        location: { coordinates: [number, number] };
        speed?: number;
        heading?: number;
        accuracy?: number;
        timestamp: Date;
        createdAt: Date;
      };
    }>) {
      const driverObjId = row._id.toString();
      const driver = await DriverModel.findById(driverObjId)
        .populate('userId', 'name email')
        .lean();
      const userDoc = driver?.userId as unknown as UserSummary | undefined;
      const driverId = userDoc?._id?.toString() || driverObjId;
      const driverName = userDoc?.name || userDoc?.email || 'Driver';
      const coords = row.location.location.coordinates;
      this.locations.set(driverId, {
        driverId,
        driverName,
        latitude: coords[1],
        longitude: coords[0],
        speed: row.location.speed,
        heading: row.location.heading,
        accuracy: row.location.accuracy,
        timestamp: row.location.timestamp.getTime(),
        receivedAt: row.location.createdAt.toISOString(),
        sequence: 0,
      });
    }
  }

  public get(driverId: string): DriverLocation | undefined {
    return this.locations.get(driverId);
  }

  public all(): DriverLocation[] {
    return [...this.locations.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }
}

export const locationState = new LocationStateService();
