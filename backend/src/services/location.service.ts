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

class LocationStateService {
  private readonly locations = new Map<string, DriverLocation>();
  private readonly sequences = new Map<string, number>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly activeDriverBookings = new Map<string, string>(); // driverUserId -> bookingId

  public setActiveBooking(driverUserId: string, bookingId: string | null): void {
    if (bookingId) {
      this.activeDriverBookings.set(driverUserId, bookingId);
    } else {
      this.activeDriverBookings.delete(driverUserId);
    }
  }

  public getActiveBooking(driverUserId: string): string | undefined {
    return this.activeDriverBookings.get(driverUserId);
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
      const driver = await DriverModel.findOne({ userId: input.driverId })
        .populate('userId', 'name email')
        .select('_id userId availabilityStatus')
        .lean();
      if (!driver) return { accepted: false, reason: 'driver_not_found' };

      const userDoc = driver.userId as unknown as UserSummary;
      const driverName = userDoc?.name || userDoc?.email || input.driverName || 'Driver';

      const previous = this.locations.get(input.driverId);
      if (previous && input.timestamp < previous.timestamp) {
        return { accepted: false, reason: 'stale' };
      }

      const sequence = (this.sequences.get(input.driverId) ?? 0) + 1;
      const location: DriverLocation = {
        ...input,
        driverName,
        sequence,
        receivedAt: new Date().toISOString(),
      };

      // Persist in DB
      await DriverLocationModel.create({
        driverId: driver._id,
        location: { type: 'Point', coordinates: [input.longitude, input.latitude] },
        speed: input.speed,
        heading: input.heading,
        accuracy: input.accuracy,
        timestamp: new Date(input.timestamp),
      });

      await DriverModel.updateOne(
        { _id: driver._id },
        {
          $set: {
            currentLocation: { type: 'Point', coordinates: [input.longitude, input.latitude] },
            lastLocationUpdate: new Date(input.timestamp),
          },
        },
      );

      this.sequences.set(input.driverId, sequence);
      this.locations.set(input.driverId, location);

      // Check active booking for telemetry computation
      let activeBookingId = this.activeDriverBookings.get(input.driverId);
      let etaMinutes: number | undefined;
      let distanceKm: number | undefined;

      const activeTrip = await BookingModel.findOne({
        driverId: driver._id,
        status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
      }).lean();

      if (activeTrip) {
        activeBookingId = activeTrip._id.toString();
        this.activeDriverBookings.set(input.driverId, activeBookingId);

        const targetCoords =
          activeTrip.status === 'TRIP_STARTED'
            ? activeTrip.dropLocation.coordinates
            : activeTrip.pickupLocation.coordinates;

        distanceKm = calculateDistanceKm(
          input.latitude,
          input.longitude,
          targetCoords[1],
          targetCoords[0],
        );
        etaMinutes = calculateEtaMinutes(
          distanceKm,
          input.speed && input.speed > 5 ? input.speed : 30,
        );

        // Update driver live location on booking
        await BookingModel.updateOne(
          { _id: activeTrip._id },
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
        );
      } else {
        this.activeDriverBookings.delete(input.driverId);
      }

      return { accepted: true, location, activeBookingId, etaMinutes, distanceKm };
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
