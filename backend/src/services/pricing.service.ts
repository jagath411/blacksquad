import { calculateDistanceKm } from './location.service';

export interface FareTier {
  id: string;
  name: string;
  baseFare: number;
  perKm: number;
  minimumFare: number;
}

// Placeholder rates in INR, to be set by the business before launch.
export const FARE_TIERS: FareTier[] = [
  { id: 'uberx', name: 'BlackSquad Express', baseFare: 50, perKm: 14, minimumFare: 100 },
  { id: 'comfort', name: 'Fleet Comfort Van', baseFare: 80, perKm: 20, minimumFare: 150 },
  { id: 'heavy', name: 'Heavy Freight Hauler', baseFare: 200, perKm: 40, minimumFare: 400 },
];

// Straight-line distance understates road distance; this factor approximates it until routing is server-side.
const ROAD_FACTOR = 1.3;

export function findTier(idOrName: string): FareTier | undefined {
  const key = idOrName.trim().toLowerCase();
  return FARE_TIERS.find((t) => t.id === key || t.name.toLowerCase() === key);
}

export function quoteFare(
  tier: FareTier,
  pickup: [number, number],
  drop: [number, number],
): { fare: number; distanceKm: number } {
  const straight = calculateDistanceKm(pickup[1], pickup[0], drop[1], drop[0]);
  const distanceKm = Math.round(straight * ROAD_FACTOR * 10) / 10;
  const fare = Math.max(tier.minimumFare, Math.round(tier.baseFare + tier.perKm * distanceKm));
  return { fare, distanceKm };
}
