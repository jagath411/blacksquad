import type { ViewStyle } from 'react-native';
export const shadows = {
  none: {} satisfies ViewStyle,
  subtle: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 } satisfies ViewStyle,
  floating: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 } satisfies ViewStyle,
  modal: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 10 } satisfies ViewStyle,
} as const;
