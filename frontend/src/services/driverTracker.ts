import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { FleetSocket } from './socket';
import { apiRequest } from './api/client';
import { getAccessToken } from './tokenStore';

export type TrackerStatus = 'offline' | 'requesting' | 'online' | 'denied' | 'error';
const BACKGROUND_TASK = 'blacksquad-driver-location';

if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (
      data as {
        locations?: {
          coords: {
            latitude: number;
            longitude: number;
            speed: number | null;
            heading: number | null;
            accuracy: number;
          };
          timestamp: number;
        }[];
      }
    ).locations;
    const position = locations?.[locations.length - 1];
    if (!position || !(await getAccessToken())) return;

    try {
      // apiRequest renews an expired access token, so tracking survives long shifts.
      await apiRequest('/drivers/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
      });
    } catch {
      // Dropped while offline; the offline queue arrives in Phase 3.
    }
  });
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  /** Metres per second, as reported by the device. */
  speed?: number;
}

/** The device's current position, or null when location is off, denied or unavailable. */
export async function getCurrentDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    if (Platform.OS === 'web') {
      return await new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: pos.coords.heading ?? undefined,
              speed: pos.coords.speed ?? undefined,
            }),
          () => resolve(null),
          { timeout: 8000, enableHighAccuracy: true, maximumAge: 10000 },
        );
      });
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function startDriverTracking(
  socket: FleetSocket,
  onStatus: (status: TrackerStatus) => void,
  onLocation?: (coords: { latitude: number; longitude: number; heading?: number; speed?: number }) => void
): Promise<() => void> {
  onStatus('requesting');

  if (Platform.OS === 'web') {
    const geo = (
      globalThis as typeof globalThis & {
        navigator?: { geolocation?: { watchPosition: Function; clearWatch: Function } };
      }
    ).navigator?.geolocation;

    if (!geo) {
      onStatus('error');
      throw new Error('Location is not supported by this browser');
    }

    const watchId = geo.watchPosition(
      (position: {
        coords: {
          latitude: number;
          longitude: number;
          speed: number | null;
          heading: number | null;
          accuracy: number;
        };
      }) => {
        onStatus('online');
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
        };
        onLocation?.(loc);
        socket.emit('driver:location', {
          ...loc,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      () => onStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => geo.clearWatch(watchId);
  }

  // 1. Request Foreground Permissions
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    onStatus('denied');
    throw new Error('Location permission was denied. Please allow location access in settings.');
  }

  onStatus('online');

  // 2. Fetch initial fix immediately
  try {
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const loc = {
      latitude: initial.coords.latitude,
      longitude: initial.coords.longitude,
      heading: initial.coords.heading || 0,
      speed: initial.coords.speed || 0,
    };
    onLocation?.(loc);
    socket.emit('driver:location', {
      ...loc,
      accuracy: initial.coords.accuracy,
      timestamp: initial.timestamp,
    });
  } catch {}

  // 3. Start high-frequency Foreground Watch
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 5,
    },
    (position) => {
      onStatus('online');
      const loc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed ?? undefined,
        heading: position.coords.heading ?? undefined,
      };
      onLocation?.(loc);
      socket.emit('driver:location', {
        ...loc,
        accuracy: position.coords.accuracy ?? undefined,
        timestamp: position.timestamp,
      });
    }
  );

  // 4. Optionally attempt background task without blocking foreground tracking
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status === 'granted') {
      await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'BlackSquad Driver Live Tracking',
          notificationBody: 'Your vehicle coordinates are live with your fleet network.',
          notificationColor: '#00D084',
        },
      });
    }
  } catch {
    // Gracefully continue with foreground watch
  }

  return () => {
    subscription.remove();
    Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => {});
  };
}
