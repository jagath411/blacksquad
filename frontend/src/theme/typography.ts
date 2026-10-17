import type { TextStyle } from 'react-native';
import { fonts } from './fonts';
export const fontSize = { caption: 12, label: 14, body: 16, cardTitle: 18, sectionTitle: 22, pageTitle: 36 } as const;
export const lineHeight = { caption: 16, label: 20, body: 24, cardTitle: 24, sectionTitle: 30, pageTitle: 42 } as const;
export const typography = {
  pageTitle: { fontSize: fontSize.pageTitle, lineHeight: lineHeight.pageTitle, fontFamily: fonts.w700, letterSpacing: -0.5 } satisfies TextStyle,
  sectionTitle: { fontSize: fontSize.sectionTitle, lineHeight: lineHeight.sectionTitle, fontFamily: fonts.w700 } satisfies TextStyle,
  cardTitle: { fontSize: fontSize.cardTitle, lineHeight: lineHeight.cardTitle, fontFamily: fonts.w600 } satisfies TextStyle,
  body: { fontSize: fontSize.body, lineHeight: lineHeight.body, fontFamily: fonts.w400 } satisfies TextStyle,
  secondary: { fontSize: fontSize.label, lineHeight: lineHeight.label, fontFamily: fonts.w400 } satisfies TextStyle,
  caption: { fontSize: fontSize.caption, lineHeight: lineHeight.caption, fontFamily: fonts.w500 } satisfies TextStyle,
  label: { fontSize: fontSize.label, lineHeight: lineHeight.label, fontFamily: fonts.w600 } satisfies TextStyle,
  button: { fontSize: fontSize.body, lineHeight: lineHeight.label, fontFamily: fonts.w600 } satisfies TextStyle,
} as const;
