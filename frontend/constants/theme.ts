import { darkColors } from '../theme';

/** Backward-compatible aliases for the original foundation screens. */
export const colors = {
  bg: darkColors.background,
  surface: darkColors.surface,
  border: darkColors.border,
  text: darkColors.text,
  muted: darkColors.textSecondary,
  green: darkColors.primary,
  danger: darkColors.danger,
} as const;
