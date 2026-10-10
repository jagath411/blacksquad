import { Alert, Linking, Platform } from 'react-native';

/** Asks a yes/no question; works on native and web. */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Opens the phone dialler for a number. */
export function callNumber(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/[\s-]/g, '')}`).catch(() => {
    if (Platform.OS === 'web') window.alert(`Call ${phone}`);
    else Alert.alert('Call', phone);
  });
}
