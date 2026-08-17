import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
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
  const [visible, setVisible] = useState(false);
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
          secureTextEntry={props.secureTextEntry && !visible}
          style={[styles.input, { color: theme.text }, style]}
        />
        {props.secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityHint="Changes whether the password is visible"
            hitSlop={8}
            onPress={() => setVisible((value) => !value)}
          >
            <Text style={[styles.visibility, { color: theme.textSecondary }]}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
        {trailing}
      </View>
      {supportingText && <Text style={[styles.supporting, { color: error ? theme.danger : theme.textSecondary }]}>{supportingText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create<{ group: ViewStyle; label: TextStyle; field: ViewStyle; input: TextStyle; supporting: TextStyle; visibility: TextStyle }>({
  group: { gap: spacing.xs },
  label: typography.label,
  field: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  input: { ...typography.body, flex: 1, minHeight: 46, paddingVertical: 0 },
  supporting: typography.caption,
  visibility: { ...typography.caption, fontWeight: '800' },
});
