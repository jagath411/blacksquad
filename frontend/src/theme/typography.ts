import type { TextStyle } from 'react-native';
export const fontSize = { caption: 12, label: 14, body: 16, cardTitle: 18, sectionTitle: 22, pageTitle: 36 } as const;
export const lineHeight = { caption: 16, label: 20, body: 24, cardTitle: 24, sectionTitle: 30, pageTitle: 42 } as const;
export const typography = {
  pageTitle: { fontSize: fontSize.pageTitle, lineHeight: lineHeight.pageTitle, fontWeight: '700', letterSpacing: -1 } satisfies TextStyle,
  sectionTitle: { fontSize: fontSize.sectionTitle, lineHeight: lineHeight.sectionTitle, fontWeight: '700' } satisfies TextStyle,
  cardTitle: { fontSize: fontSize.cardTitle, lineHeight: lineHeight.cardTitle, fontWeight: '600' } satisfies TextStyle,
  body: { fontSize: fontSize.body, lineHeight: lineHeight.body, fontWeight: '400' } satisfies TextStyle,
  secondary: { fontSize: fontSize.label, lineHeight: lineHeight.label, fontWeight: '400' } satisfies TextStyle,
  caption: { fontSize: fontSize.caption, lineHeight: lineHeight.caption, fontWeight: '500' } satisfies TextStyle,
  label: { fontSize: fontSize.label, lineHeight: lineHeight.label, fontWeight: '600' } satisfies TextStyle,
  button: { fontSize: fontSize.body, lineHeight: lineHeight.label, fontWeight: '600' } satisfies TextStyle,
} as const;
