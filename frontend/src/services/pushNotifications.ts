import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiRequest } from './api/client';

export interface TripNotificationData {
  bookingId?: string;
  status?: string;
  type?: 'RIDE_OFFER';
}

// Show trip notifications even while the app is open; the screen also updates on its own.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission and registers this phone with the server.
 * Does nothing on web or simulators, where push is not available.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trips', {
      name: 'Trips and ride requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await apiRequest('/auth/push-token', { method: 'POST', body: JSON.stringify({ pushToken }) });
}

/** Calls back with the trip data of any notification the user taps. */
export function onNotificationTap(callback: (data: TripNotificationData) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    callback((response.notification.request.content.data ?? {}) as TripNotificationData);
  });
  return () => subscription.remove();
}
