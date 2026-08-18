import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { darkColors, lightColors, radius, shadows, spacing } from '../../theme';

export interface CardProps extends PropsWithChildren {
  tone?: 'light' | 'dark';
  variant?: 'flat' | 'outlined' | 'elevated';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'light', variant = 'outlined', compact = false, style }: CardProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  return (
    <View
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: theme.surface },
        variant !== 'flat' && { borderColor: theme.border, borderWidth: 1 },
        variant === 'elevated' && shadows.subtle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children }: PropsWithChildren) {
  return <View style={styles.header}>{children}</View>;
}
export function CardContent({ children }: PropsWithChildren) {
  return <View style={styles.content}>{children}</View>;
}
export function CardFooter({ children }: PropsWithChildren) {
  return <View style={styles.footer}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden' },
  regular: { padding: spacing.lg },
  compact: { padding: spacing.md },
  header: { marginBottom: spacing.sm },
  content: { gap: spacing.xs },
  footer: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
