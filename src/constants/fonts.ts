/**
 * Fonts in assets/fonts. Link with: npx react-native-asset
 * - Nunito Sans: variable fonts (already in repo)
 * - Integral CF: add Integral CF.ttf to assets/fonts (use for headings)
 */
export const FONTS = {
  NUNITO_SANS: 'Nunito Sans',
  INTEGRAL_CF: 'Integral CF',
} as const;

/** Use for headings (Integral CF) */
export const FONT_HEADING = FONTS.INTEGRAL_CF;

/** Use for body text (Nunito Sans) */
export const FONT_BODY = FONTS.NUNITO_SANS;

/** Body Medium typography (Nunito Sans) */
export const TYPOGRAPHY_BODY_MEDIUM = {
  fontFamily: FONTS.NUNITO_SANS,
  fontWeight: '400' as const,
  fontStyle: 'normal' as const,
  fontSize: 14,
  lineHeight: 20,
  letterSpacing: 0,
};
