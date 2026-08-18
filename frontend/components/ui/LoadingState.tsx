import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { darkColors, lightColors, spacing, typography } from '../../theme';

export function LoadingState({ label = 'Loading…', tone = 'light' }: { label?: string; tone?: 'light' | 'dark' }) {
  const theme = tone === 'light' ? lightColors : darkColors;
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl }, label: typography.secondary });
