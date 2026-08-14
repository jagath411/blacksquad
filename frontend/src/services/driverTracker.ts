import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { FleetSocket } from './socket';

export type TrackerStatus = 'offline' | 'requesting' | 'online' | 'denied' | 'error';
type WebWatch = { clearWatch: () => void };

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
  const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, (position) => {
    onStatus('online');
    socket.emit('driver:location', { latitude: position.coords.latitude, longitude: position.coords.longitude, speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined, accuracy: position.coords.accuracy ?? undefined, timestamp: position.timestamp });
  });
  return () => subscription.remove();
}

export type TrackerCleanup = WebWatch | (() => void);
