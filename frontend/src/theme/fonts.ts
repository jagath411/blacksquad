/**
 * Barlow is drawn from road-sign lettering; it stays legible at a glance in sunlight.
 * React Native picks font files by family name, so each weight is its own family.
 */
export const fonts = {
  w400: 'Barlow_400Regular',
  w500: 'Barlow_500Medium',
  w600: 'Barlow_600SemiBold',
  w700: 'Barlow_700Bold',
  /** Condensed figures for fares, PINs, number plates and timers. */
  figures: 'BarlowCondensed_600SemiBold',
  figuresBold: 'BarlowCondensed_700Bold',
} as const;
