export const palette = {
  blue50: '#EFF6FF', blue100: '#DBEAFE', blue200: '#BFDBFE', blue500: '#3B82F6',
  blue600: '#2563EB', blue700: '#1D4ED8', slate50: '#F8FAFC', slate100: '#F1F5F9',
  slate200: '#E2E8F0', slate400: '#94A3B8', slate500: '#64748B', slate700: '#334155',
  slate900: '#0F172A', white: '#FFFFFF', black: '#080B12', red50: '#FEF2F2',
  red600: '#DC2626', amber50: '#FFFBEB', amber600: '#D97706', green50: '#F0FDF4',
  green600: '#16A34A',
} as const;

export const lightColors = {
  background: palette.slate50, surface: palette.white, surfaceSubtle: palette.slate100,
  border: palette.slate200, borderStrong: palette.slate400, text: palette.slate900,
  textSecondary: palette.slate500, textInverse: palette.white, primary: palette.blue600,
  primaryPressed: palette.blue700, primarySubtle: palette.blue50, focus: palette.blue500,
  success: palette.green600, successSubtle: palette.green50, warning: palette.amber600,
  warningSubtle: palette.amber50, danger: palette.red600, dangerSubtle: palette.red50,
  overlay: 'rgba(15, 23, 42, 0.44)',
} as const;

export const darkColors = {
  background: palette.black, surface: '#111827', surfaceSubtle: '#172033', border: '#273449',
  borderStrong: '#475569', text: '#F8FAFC', textSecondary: '#A7B2C3',
  textInverse: palette.slate900, primary: '#60A5FA', primaryPressed: '#93C5FD',
  primarySubtle: '#172B4D', focus: '#60A5FA', success: '#4ADE80',
  successSubtle: '#12301F', warning: '#FBBF24', warningSubtle: '#33260B',
  danger: '#F87171', dangerSubtle: '#351719', overlay: 'rgba(0, 0, 0, 0.60)',
} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;
