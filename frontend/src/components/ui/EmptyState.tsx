import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../AppButton';
import { darkColors, lightColors, spacing, typography } from '../../theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'light' | 'dark';
}
export function EmptyState({ title, description, icon, actionLabel, onAction, tone = 'light' }: EmptyStateProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  return (
    <View style={styles.container}>
      {icon}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description && <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>}
      {actionLabel && onAction && <AppButton label={actionLabel} onPress={onAction} tone={tone} fullWidth={false} />}
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing['2xl'] }, title: { ...typography.cardTitle, textAlign: 'center' }, description: { ...typography.secondary, textAlign: 'center', maxWidth: 360 } });
