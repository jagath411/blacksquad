export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  receivedAt: string;
  sequence: number;
}

export type LocationUpdateResult = { accepted: true; location: DriverLocation } | { accepted: false; reason: 'stale' };

class LocationStateService {
  private readonly locations = new Map<string, DriverLocation>();
  private readonly sequences = new Map<string, number>();

  public update(input: Omit<DriverLocation, 'receivedAt' | 'sequence'>): LocationUpdateResult {
    const previous = this.locations.get(input.driverId);
    if (previous && input.timestamp < previous.timestamp) return { accepted: false, reason: 'stale' };
    const sequence = (this.sequences.get(input.driverId) ?? 0) + 1;
    const location: DriverLocation = { ...input, sequence, receivedAt: new Date().toISOString() };
    this.sequences.set(input.driverId, sequence);
    this.locations.set(input.driverId, location);
    return { accepted: true, location };
  }

  public get(driverId: string): DriverLocation | undefined { return this.locations.get(driverId); }
  public all(): DriverLocation[] { return [...this.locations.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)); }
}

export const locationState = new LocationStateService();
