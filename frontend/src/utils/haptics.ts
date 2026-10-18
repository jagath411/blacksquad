import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Short physical feedback for moments that matter. Does nothing on web.
const run = (fn: () => Promise<void>) => {
  if (Platform.OS !== 'web') fn().catch(() => undefined);
};

export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
