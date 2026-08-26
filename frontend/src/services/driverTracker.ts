import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { FleetSocket } from './socket';
import { API_BASE_URL } from './api/client';
import { getAccessToken } from './tokenStore';

export type TrackerStatus = 'offline' | 'requesting' | 'online' | 'denied' | 'error';
const BACKGROUND_TASK = 'blacksquad-driver-location';

if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (
      data as {
        locations?: Array<{
          coords: {
            latitude: number;
            longitude: number;
            speed: number | null;
            heading: number | null;
            accuracy: number;
          };
          timestamp: number;
        }>;
      }
    ).locations;
    const position = locations?.[locations.length - 1];
    const token = await getAccessToken();
    if (!position || !token) return;

    try {
      await fetch(`${API_BASE_URL}/drivers/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
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
      // background network retry handled by OS task manager
    }
  });
}

export async function getCurrentDeviceLocation(): Promise<{
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}> {
  const fallback = { latitude: 12.9716, longitude: 77.5946, heading: 0, speed: 0 };
  try {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          return resolve(fallback);
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
            }),
          () => resolve(fallback),
          { timeout: 5000, enableHighAccuracy: true, maximumAge: 10000 }
        );
      });
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return fallback;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading || 0,
      speed: location.coords.speed || 0,
    };
  } catch (err) {
    return fallback;
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
