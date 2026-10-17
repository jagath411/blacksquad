import { go, ink, line, brand, brandDeep, paper, route, stop, subtle, surface, text2 } from './palette';

export const palette = {
  ink, paper, surface, subtle, line, text2, brand, brandDeep, go, route, stop,
  white: '#FFFFFF',
} as const;

/**
 * The app has one daylight theme. Both names point at it so older screens that ask for
 * "dark" or "light" render the same way.
 */
export const lightColors = {
  background: paper,
  surface,
  surfaceSubtle: subtle,
  border: line,
  borderStrong: '#9AA4B0',
  text: ink,
  textSecondary: text2,
  textInverse: '#FFFFFF',
  primary: brand,
  primaryPressed: brandDeep,
  primarySubtle: '#E6ECFB',
  focus: route,
  success: go,
  successSubtle: '#E3F2EA',
  warning: '#B7791F',
  warningSubtle: '#E6ECFB',
  danger: stop,
  dangerSubtle: '#FBE9E7',
  overlay: 'rgba(29, 35, 43, 0.45)',
} as const;

export const darkColors = lightColors;

export type ThemeColors = typeof lightColors;
