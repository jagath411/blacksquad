import { useEffect, useMemo, useState } from 'react';
import { createFleetSocket, type DriverLocationEvent } from '../services/socket';

export interface FleetDriver extends DriverLocationEvent { connection: 'online' | 'stale'; }
export interface FleetDriverSummary { id: string; lat: number; lng: number; name: string; state: string; color: string; vehicle: string; }
export function useFleet() {
  const [locations, setLocations] = useState<Record<string, DriverLocationEvent>>({});
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => { let socket: Awaited<ReturnType<typeof createFleetSocket>> | undefined; let cancelled = false;
    void createFleetSocket().then((next) => { if (cancelled) { next.close(); return; } socket = next; setConnection('connected'); next.on('connect_error', () => setConnection('error')); next.on('disconnect', () => setConnection('disconnected')); next.on('fleet:snapshot', (items: DriverLocationEvent[]) => setLocations(Object.fromEntries(items.map((item) => [item.driverId, item])))); next.on('fleet:location', (item: DriverLocationEvent) => setLocations((current) => ({ ...current, [item.driverId]: item }))); next.emit('owner:fleet:subscribe'); }).catch(() => setConnection('error'));
    return () => { cancelled = true; socket?.close(); };
  }, []);
  const fleet = useMemo<FleetDriver[]>(() => Object.values(locations).map((location) => ({ ...location, connection: now - new Date(location.receivedAt).getTime() < 30000 ? 'online' : 'stale' })), [locations, now]);
  const drivers: FleetDriverSummary[] = fleet.map((driver) => ({
    id: driver.driverId,
    lat: driver.latitude,
    lng: driver.longitude,
    name: driver.driverName || `Driver ${driver.driverId.slice(-4)}`,
    state: driver.connection === 'online' ? 'Online' : 'Offline',
    color: driver.connection === 'online' ? '#16A34A' : '#D97706',
    vehicle: driver.speed == null ? 'Location available' : `${Math.round(driver.speed)} km/h`,
  }));
  return { fleet, drivers, connection };
}
