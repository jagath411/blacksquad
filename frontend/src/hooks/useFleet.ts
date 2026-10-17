import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFleetSocket, type DriverLocationEvent } from '../services/socket';
import { getFleetDrivers, type FleetDriverItem } from '../services/driverService';

export interface FleetDriverSummary {
  id: string;
  driverDocId: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  vehiclePlate: string;
  vehicleType: string;
  licenseNumber: string;
  state: 'Online' | 'On Trip' | 'Offline';
  color: string;
  /** Null until the driver has sent a GPS position. */
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  lastUpdated: string;
  isLive: boolean;
}

export function useFleet() {
  const [dbDrivers, setDbDrivers] = useState<FleetDriverItem[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, DriverLocationEvent>>({});
  const [driverStatuses, setDriverStatuses] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [loading, setLoading] = useState(false);

  // 1. Fetch all fleet drivers from database via REST API
  const refreshFleet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFleetDrivers();
      setDbDrivers(data);
    } catch (err) {
      console.warn('[useFleet] REST driver fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFleet();
  }, [refreshFleet]);

  // 2. Real-Time Socket.IO Synchronization
  useEffect(() => {
    let socket: Awaited<ReturnType<typeof createFleetSocket>> | undefined;
    let cancelled = false;
    const onConnectError = () => setConnection('error');
    const onDisconnect = () => setConnection('disconnected');

    void createFleetSocket()
      .then((s) => {
        if (cancelled) return;
        socket = s;
        setConnection('connected');

        s.on('connect_error', onConnectError);
        s.on('disconnect', onDisconnect);

        // Snapshot from server
        s.on('fleet:snapshot', (items: any[]) => {
          if (!Array.isArray(items)) return;
          const locMap: Record<string, DriverLocationEvent> = {};
          const statusMap: Record<string, string> = {};
          items.forEach((item) => {
            if (item.driverId) {
              locMap[item.driverId] = {
                driverId: item.driverId,
                driverName: item.driverName,
                latitude: item.latitude,
                longitude: item.longitude,
                speed: item.speed,
                heading: item.heading,
                accuracy: item.accuracy,
                timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
                sequence: typeof item.sequence === 'number' ? item.sequence : 0,
                receivedAt: item.receivedAt || new Date().toISOString(),
              };
              if (item.status) {
                statusMap[item.driverId] = item.status;
              }
            }
          });
          setLiveLocations((prev) => ({ ...prev, ...locMap }));
          setDriverStatuses((prev) => ({ ...prev, ...statusMap }));
        });

        // Live location update event
        s.on('fleet:location', (loc: DriverLocationEvent) => {
          if (loc && loc.driverId) {
            setLiveLocations((prev) => ({ ...prev, [loc.driverId]: loc }));
          }
        });

        // Driver online/offline status event
        s.on('fleet:driver:status', (payload: { driverId: string; status: string; location?: DriverLocationEvent }) => {
          if (payload && payload.driverId) {
            setDriverStatuses((prev) => ({ ...prev, [payload.driverId]: payload.status }));
            if (payload.location) {
              setLiveLocations((prev) => ({ ...prev, [payload.driverId]: payload.location! }));
            }
          }
        });

        // Subscribe to fleet room
        s.emit('owner:fleet:subscribe');
      })
      .catch(() => setConnection('error'));

    return () => {
      cancelled = true;
      // The socket is shared with other screens: remove only this hook's listeners.
      socket?.off('connect_error', onConnectError);
      socket?.off('disconnect', onDisconnect);
      for (const event of ['fleet:snapshot', 'fleet:location', 'fleet:driver:status']) socket?.off(event);
    };
  }, []);

  // 3. Merge Database Drivers + Live Socket Telemetry into Consolidated Drivers List
  const drivers: FleetDriverSummary[] = useMemo(() => {
    return dbDrivers.map((d) => {
      const driverUserId = d.userId?._id?.toString() || (d.userId as any)?.toString() || d._id;
      const live = liveLocations[driverUserId] || (d.liveLocation as any);
      const dynamicStatus = driverStatuses[driverUserId] || d.availabilityStatus || 'OFFLINE';

      // Check if location was received recently (within 5 minutes)
      const lastReceivedTime = live?.receivedAt ? new Date(live.receivedAt).getTime() : 0;
      const isRecent = Date.now() - lastReceivedTime < 5 * 60 * 1000;
      const isOnline = dynamicStatus === 'AVAILABLE' || (isRecent && dynamicStatus !== 'OFFLINE');
      const isOnTrip = dynamicStatus === 'ON_TRIP';

      const state: 'Online' | 'On Trip' | 'Offline' = isOnTrip
        ? 'On Trip'
        : isOnline
        ? 'Online'
        : 'Offline';

      const color = isOnTrip ? '#2457D6' : isOnline ? '#1E8E5A' : '#7A8592';

      const lat = live?.latitude ?? d.currentLocation?.coordinates?.[1] ?? null;
      const lng = live?.longitude ?? d.currentLocation?.coordinates?.[0] ?? null;

      const vehiclePlate = d.vehicleId?.registrationNumber || 'No Vehicle Linked';
      const vehicleModel = d.vehicleId?.model || d.vehicleId?.vehicleType || 'Fleet Pool';

      return {
        id: driverUserId,
        driverDocId: d._id,
        name: d.userId?.name || `Driver ${driverUserId.slice(-4)}`,
        email: d.userId?.email || '',
        phone: d.userId?.phoneNumber || '',
        vehicle: `${vehiclePlate} (${vehicleModel})`,
        vehiclePlate,
        vehicleType: d.vehicleId?.vehicleType || 'SEDAN',
        licenseNumber: d.licenseNumber || 'Verified License',
        state,
        color,
        lat,
        lng,
        speed: typeof live?.speed === 'number' ? live.speed : null,
        heading: typeof live?.heading === 'number' ? live.heading : null,
        lastUpdated: live?.receivedAt || d.lastLocationUpdate || d.updatedAt,
        isLive: isOnline || isOnTrip,
      };
    });
  }, [dbDrivers, liveLocations, driverStatuses]);

  return {
    drivers,
    rawDrivers: dbDrivers,
    connection,
    loading,
    refreshFleet,
  };
}
