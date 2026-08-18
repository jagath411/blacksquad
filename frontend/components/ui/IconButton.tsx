import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { darkColors, lightColors, radius, shadows } from '../../theme';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  accessibilityLabel: string;
  tone?: 'light' | 'dark';
  variant?: 'plain' | 'outlined' | 'floating';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

const sizes = { sm: 36, md: 44, lg: 52 } as const;

export function IconButton({ children, accessibilityLabel, tone = 'light', variant = 'plain', size = 'md', disabled, style, ...props }: IconButtonProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  const dimension = sizes[size];
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        { width: dimension, height: dimension, borderRadius: radius.full, backgroundColor: variant === 'plain' ? 'transparent' : theme.surface },
        variant !== 'plain' && { borderColor: theme.border, borderWidth: 1 },
        variant === 'floating' && shadows.floating,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
});
