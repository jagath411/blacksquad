import { calculateDistanceMeters, toKmh } from '../utils/geo';

describe('geo helpers', () => {
  it('measures distance between two points in metres', () => {
    // MG Road to Indiranagar, Bengaluru: about 4.3 km in a straight line.
    const meters = calculateDistanceMeters([77.6070, 12.9750], [77.6408, 12.9784]);
    expect(meters).toBeGreaterThan(3500);
    expect(meters).toBeLessThan(4200);
  });

  it('is zero for the same point', () => {
    expect(calculateDistanceMeters([77.6, 12.9], [77.6, 12.9])).toBe(0);
  });

  it('converts device speed from metres per second to km/h', () => {
    expect(toKmh(10)).toBe(36);
    expect(toKmh(undefined)).toBe(0);
    expect(toKmh(-1)).toBe(0);
  });
});
