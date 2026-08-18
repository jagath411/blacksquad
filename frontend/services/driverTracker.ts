import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { FleetSocket } from './socket';
import { API_BASE_URL } from './api/client';
import { getAccessToken } from './tokenStore';

export type TrackerStatus = 'offline' | 'requesting' | 'online' | 'denied' | 'error';
type WebWatch = { clearWatch: () => void };
const BACKGROUND_TASK = 'blacksquad-driver-location';

if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Array<{ coords: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number }; timestamp: number }> }).locations;
    const position = locations?.[locations.length - 1];
    const token = await getAccessToken();
    if (!position || !token) return;
    await fetch(`${API_BASE_URL}/drivers/location`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined, accuracy: position.coords.accuracy, timestamp: position.timestamp }) });
  });
}

export async function startDriverTracking(socket: FleetSocket, onStatus: (status: TrackerStatus) => void): Promise<() => void> {
  onStatus('requesting');

  if (Platform.OS === 'web') {
    const geo = (globalThis as typeof globalThis & { navigator?: { geolocation?: { watchPosition: Function; clearWatch: Function } } }).navigator?.geolocation;
    if (!geo) {
      onStatus('error');
      throw new Error('Location is not supported on this browser.');
    }
    const watchId = geo.watchPosition(
      (position: { coords: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number } }) => {
        onStatus('online');
        socket.emit('driver:location', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      () => onStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => geo.clearWatch(watchId);
  }

  // 1. Check if device location services (GPS) are turned on
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled) {
    await Location.enableNetworkProviderAsync().catch(() => {});
  }

  // 2. Check if foreground permission is already granted before prompting
  let fgStatus = (await Location.getForegroundPermissionsAsync()).status;
  if (fgStatus !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    fgStatus = requested.status;
  }

  if (fgStatus !== 'granted') {
    onStatus('denied');
    throw new Error('Location permission is required so passengers and owners can see your live vehicle position.');
  }

  // 3. Start high-frequency foreground watch
  onStatus('online');
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 4000,
      distanceInterval: 5,
    },
    (position) => {
      onStatus('online');
      socket.emit('driver:location', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed ?? undefined,
        heading: position.coords.heading ?? undefined,
        accuracy: position.coords.accuracy ?? undefined,
        timestamp: position.timestamp,
      });
    }
  );

  // 4. Opportunistically register background updates if background permission is granted
  try {
    let bgStatus = (await Location.getBackgroundPermissionsAsync()).status;
    if (bgStatus !== 'granted') {
      const requestedBg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      if (requestedBg) bgStatus = requestedBg.status;
    }

    if (bgStatus === 'granted') {
      await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'BlackSquad Driver Online',
          notificationBody: 'Broadcasting live fleet GPS to dispatch console.',
          notificationColor: '#10B981',
        },
      }).catch(() => {});
    }
  } catch {
    // Non-fatal: foreground tracking is already running smoothly
  }

  return () => {
    subscription.remove();
    Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => {});
  };
}
