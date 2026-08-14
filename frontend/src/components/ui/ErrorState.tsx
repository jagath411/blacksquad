import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../AppButton';
import { darkColors, lightColors, spacing, typography } from '../../theme';

export interface ErrorStateProps {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  tone?: 'light' | 'dark';
}
export function ErrorState({ title = 'Something went wrong', message, retryLabel = 'Try again', onRetry, tone = 'light' }: ErrorStateProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  return (
    <View accessibilityRole="alert" style={[styles.container, { backgroundColor: theme.dangerSubtle }]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      {onRetry && <AppButton label={retryLabel} onPress={onRetry} tone={tone} variant="secondary" fullWidth={false} />}
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl }, title: { ...typography.cardTitle, textAlign: 'center' }, message: { ...typography.secondary, textAlign: 'center', maxWidth: 380 } });
