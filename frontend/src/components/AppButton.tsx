import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { darkColors, lightColors, radius, spacing, typography } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  tone?: 'light' | 'dark';
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({ label, variant = 'primary', tone = 'dark', loading = false, fullWidth = true, leadingIcon, disabled, style, accessibilityLabel, ...props }: AppButtonProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  const isDisabled = disabled || loading;
  const variantStyle: ViewStyle = variant === 'primary'
    ? { backgroundColor: theme.primary, borderColor: theme.primary }
    : variant === 'danger'
      ? { backgroundColor: theme.danger, borderColor: theme.danger }
      : variant === 'secondary'
        ? { backgroundColor: theme.surface, borderColor: theme.primary }
        : { backgroundColor: 'transparent', borderColor: 'transparent' };
  const labelColor = variant === 'primary' || variant === 'danger' ? theme.textInverse : theme.primary;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, fullWidth && styles.fullWidth, variantStyle, pressed && styles.pressed, isDisabled && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color={labelColor} /> : <>{leadingIcon}<Text style={[styles.label, { color: labelColor }]}>{label}</Text></>}
    </Pressable>
  );
}

const styles = StyleSheet.create<{ base: ViewStyle; fullWidth: ViewStyle; pressed: ViewStyle; disabled: ViewStyle; label: TextStyle }>({
  base: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  label: typography.button,
});
