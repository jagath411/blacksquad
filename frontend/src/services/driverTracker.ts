import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { FleetSocket } from './socket';
import { getAccessToken } from './tokenStore';
import { flushPendingFix, uploadFix, type GpsFix } from './locationUploader';

export type TrackerStatus = 'offline' | 'requesting' | 'online' | 'denied' | 'error';
const BACKGROUND_TASK = 'blacksquad-driver-location';

// Moving: an update every few seconds. The distance filter stops updates while parked.
const UPDATE_INTERVAL_MS = 5000;
const DISTANCE_FILTER_METERS = 10;

type FixListener = (fix: GpsFix) => void;
const fixListeners = new Set<FixListener>();

interface RawLocation {
  coords: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number | null };
  timestamp: number;
}

const toFix = (position: RawLocation): GpsFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  speed: position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : undefined,
  heading: position.coords.heading != null && position.coords.heading >= 0 ? position.coords.heading : undefined,
  accuracy: position.coords.accuracy ?? undefined,
  timestamp: position.timestamp,
});

/** Every fix goes through here, whether the app is open, in the background or the phone is locked. */
async function handleFix(fix: GpsFix): Promise<void> {
  fixListeners.forEach((listener) => listener(fix));
  await uploadFix(fix);
}

// Defined at module load so the OS can wake the app and deliver locations while it is closed.
if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: RawLocation[] }).locations;
    const latest = locations?.[locations.length - 1];
    if (!latest || !(await getAccessToken())) return;
    await handleFix(toFix(latest));
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

/**
 * Starts sharing the driver's position until the returned function is called.
 *
 * With "Allow all the time" location, one background task delivers every fix, whether the app
 * is open, in the background or the phone is locked (Android shows a notification while it runs).
 * Without it, positions are sent only while the app is open.
 *
 * askBackground is shown before the system's "all the time" prompt; app stores require that
 * explanation. It resolves true when the driver agrees.
 */
export async function startDriverTracking(
  socket: FleetSocket,
  onStatus: (status: TrackerStatus) => void,
  onLocation?: (coords: { latitude: number; longitude: number; heading?: number; speed?: number }) => void,
  askBackground?: () => Promise<boolean>,
): Promise<() => void> {
  onStatus('requesting');
  const listener: FixListener = (fix) => {
    onStatus('online');
    onLocation?.({ latitude: fix.latitude, longitude: fix.longitude, heading: fix.heading, speed: fix.speed });
  };
  fixListeners.add(listener);

  // Anything held while offline goes out as soon as the socket is back.
  const onReconnect = () => void flushPendingFix();
  socket.on('connect', onReconnect);
  const detach = () => {
    fixListeners.delete(listener);
    socket.off('connect', onReconnect);
  };

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      detach();
      onStatus('error');
      throw new Error('Location is not supported by this browser');
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => void handleFix(toFix(position as unknown as RawLocation)),
      () => onStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
      detach();
    };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    detach();
    onStatus('denied');
    throw new Error('Location permission was denied. Please allow location access in settings.');
  }

  try {
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await handleFix(toFix(initial));
  } catch {
    // The watch below will deliver a fix as soon as one is available.
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted' && background.canAskAgain && askBackground && (await askBackground())) {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  if (background.status === 'granted') {
    await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: UPDATE_INTERVAL_MS,
      distanceInterval: DISTANCE_FILTER_METERS,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'BlackSquad: you are online',
        notificationBody: 'Your location is shared with riders and your fleet while you are online.',
        notificationColor: '#00D084',
        killServiceOnDestroy: false,
      },
    });
    return () => {
      Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => undefined);
      detach();
    };
  }

  // Foreground only: updates stop when the app is closed or the phone is locked.
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: UPDATE_INTERVAL_MS, distanceInterval: DISTANCE_FILTER_METERS },
    (position) => void handleFix(toFix(position)),
  );
  return () => {
    subscription.remove();
    detach();
  };
}

/** Whether the driver has allowed location "all the time" (needed to track with the screen off). */
export async function hasBackgroundLocation(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Location.getBackgroundPermissionsAsync();
  return status === 'granted';
}
