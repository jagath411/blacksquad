/** Great-circle distance in metres between two [longitude, latitude] points. */
export function calculateDistanceMeters(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Converts a device speed in metres per second to whole km/h. */
export const toKmh = (metresPerSecond: number | undefined | null): number =>
  Math.max(0, Math.round((metresPerSecond ?? 0) * 3.6));
