import { useEffect, useMemo, useState } from 'react';
import { createFleetSocket, type DriverLocationEvent } from '../services/socket';

export interface FleetDriver extends DriverLocationEvent { connection: 'online' | 'stale'; }
export function useFleet() {
  const [locations, setLocations] = useState<Record<string, DriverLocationEvent>>({});
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => { let socket: Awaited<ReturnType<typeof createFleetSocket>> | undefined; let cancelled = false;
    void createFleetSocket().then((next) => { if (cancelled) { next.close(); return; } socket = next; setConnection('connected'); next.on('connect_error', () => setConnection('error')); next.on('disconnect', () => setConnection('disconnected')); next.on('fleet:snapshot', (items) => setLocations(Object.fromEntries(items.map((item) => [item.driverId, item])))); next.on('fleet:location', (item) => setLocations((current) => ({ ...current, [item.driverId]: item }))); next.emit('owner:fleet:subscribe'); }).catch(() => setConnection('error'));
    return () => { cancelled = true; socket?.close(); };
  }, []);
  const fleet = useMemo<FleetDriver[]>(() => Object.values(locations).map((location) => ({ ...location, connection: now - new Date(location.receivedAt).getTime() < 30000 ? 'online' : 'stale' })), [locations, now]);
  return { fleet, connection };
}
