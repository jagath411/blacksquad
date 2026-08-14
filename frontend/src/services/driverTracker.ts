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
    if (!geo) { onStatus('error'); throw new Error('Location is not supported by this browser'); }
    const watchId = geo.watchPosition((position: { coords: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number } }) => {
      onStatus('online');
      socket.emit('driver:location', { latitude: position.coords.latitude, longitude: position.coords.longitude, speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined, accuracy: position.coords.accuracy, timestamp: Date.now() });
    }, () => onStatus('denied'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => geo.clearWatch(watchId);
  }
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') { onStatus('denied'); throw new Error('Location permission was denied'); }
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') { onStatus('denied'); throw new Error('Background location permission was denied'); }
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'BlackSquad driver tracking', notificationBody: 'Your live location is being shared with your transport owner.', notificationColor: '#2563EB' } });
  const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, (position) => {
    onStatus('online');
    socket.emit('driver:location', { latitude: position.coords.latitude, longitude: position.coords.longitude, speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined, accuracy: position.coords.accuracy ?? undefined, timestamp: position.timestamp });
  });
  return () => { subscription.remove(); void Location.stopLocationUpdatesAsync(BACKGROUND_TASK); };
}

export type TrackerCleanup = WebWatch | (() => void);
