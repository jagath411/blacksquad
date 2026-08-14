import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { darkColors, lightColors, spacing } from '../theme';

export interface ScreenProps extends PropsWithChildren {
  tone?: 'light' | 'dark';
  scroll?: boolean;
  padded?: boolean;
  maxWidth?: number;
  decorative?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, tone = 'dark', scroll = true, padded = true, maxWidth = 560, decorative = true, contentContainerStyle }: ScreenProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  const contentStyle: StyleProp<ViewStyle> = [styles.content, padded && styles.padded, { maxWidth }, contentContainerStyle];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {decorative && <View pointerEvents="none" style={[styles.glow, { backgroundColor: theme.primarySubtle }]} />}
      {scroll ? (
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  glow: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -190, right: -130, opacity: 0.62 },
  content: { flexGrow: 1, width: '100%', alignSelf: 'center' },
  padded: { padding: spacing.xl },
});
