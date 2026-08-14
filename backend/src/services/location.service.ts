import { DriverLocationModel } from '../models/DriverLocation';
import { DriverModel } from '../models/Driver';

export interface DriverLocation { driverId: string; latitude: number; longitude: number; speed?: number; heading?: number; accuracy?: number; timestamp: number; receivedAt: string; sequence: number; }
export type LocationUpdateResult = { accepted: true; location: DriverLocation } | { accepted: false; reason: 'stale' | 'driver_not_found' };

class LocationStateService {
  private readonly locations = new Map<string, DriverLocation>();
  private readonly sequences = new Map<string, number>();
  private readonly locks = new Map<string, Promise<unknown>>();

  public async update(input: Omit<DriverLocation, 'receivedAt' | 'sequence'>): Promise<LocationUpdateResult> {
    const previousLock = this.locks.get(input.driverId) ?? Promise.resolve();
    let resolveLock!: () => void;
    const currentLock = new Promise<void>((resolve) => { resolveLock = resolve; });
    const chain = previousLock.then(() => currentLock);
    this.locks.set(input.driverId, chain);
    await previousLock;
    try {
      const driver = await DriverModel.findOne({ userId: input.driverId }).select('_id').lean();
      if (!driver) return { accepted: false, reason: 'driver_not_found' };
      const previous = this.locations.get(input.driverId);
      if (previous && input.timestamp < previous.timestamp) return { accepted: false, reason: 'stale' };
      const sequence = (this.sequences.get(input.driverId) ?? 0) + 1;
      const location: DriverLocation = { ...input, sequence, receivedAt: new Date().toISOString() };
      await DriverLocationModel.create({ driverId: driver._id, location: { type: 'Point', coordinates: [input.longitude, input.latitude] }, speed: input.speed, heading: input.heading, accuracy: input.accuracy, timestamp: new Date(input.timestamp) });
      await DriverModel.updateOne({ _id: driver._id }, { $set: { currentLocation: { type: 'Point', coordinates: [input.longitude, input.latitude] }, lastLocationUpdate: new Date(input.timestamp) } });
      this.sequences.set(input.driverId, sequence); this.locations.set(input.driverId, location);
      return { accepted: true, location };
    } finally { resolveLock(); if (this.locks.get(input.driverId) === chain) this.locks.delete(input.driverId); }
  }

  public async loadFromDatabase(): Promise<void> {
    const latest = await DriverLocationModel.aggregate([{ $sort: { timestamp: -1 } }, { $group: { _id: '$driverId', location: { $first: '$$ROOT' } } }]);
    for (const row of latest as Array<{ _id: { toString(): string }; location: { location: { coordinates: [number, number] }; speed?: number; heading?: number; accuracy?: number; timestamp: Date; createdAt: Date } }>) {
      const driverId = row._id.toString(); const coords = row.location.location.coordinates;
      this.locations.set(driverId, { driverId, latitude: coords[1], longitude: coords[0], speed: row.location.speed, heading: row.location.heading, accuracy: row.location.accuracy, timestamp: row.location.timestamp.getTime(), receivedAt: row.location.createdAt.toISOString(), sequence: 0 });
    }
  }
  public get(driverId: string): DriverLocation | undefined { return this.locations.get(driverId); }
  public all(): DriverLocation[] { return [...this.locations.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)); }
}
export const locationState = new LocationStateService();
