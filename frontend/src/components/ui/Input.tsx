import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { darkColors, lightColors, radius, spacing, typography } from '../../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  tone?: 'light' | 'dark';
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Input({ label, helperText, error, tone = 'light', leading, trailing, style, accessibilityLabel, ...props }: InputProps) {
  const theme = tone === 'light' ? lightColors : darkColors;
  const supportingText = error ?? helperText;
  return (
    <View style={styles.group}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border }]}>
        {leading}
        <TextInput
          {...props}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: props.editable === false }}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, style]}
        />
        {trailing}
      </View>
      {supportingText && <Text style={[styles.supporting, { color: error ? theme.danger : theme.textSecondary }]}>{supportingText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create<{ group: ViewStyle; label: TextStyle; field: ViewStyle; input: TextStyle; supporting: TextStyle }>({
  group: { gap: spacing.xs },
  label: typography.label,
  field: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  input: { ...typography.body, flex: 1, minHeight: 46, paddingVertical: 0 },
  supporting: typography.caption,
});
