/**
 * Global app colors. Primary theme: #095CD7
 */
export const COLORS = {
  /** Primary theme blue */
  primary: '#095CD7',
  /** Error state (icons, messages) */
  error: '#FA7777',
  /** Primary text / labels */
  text: '#1A1A1A',
  /** Secondary / placeholder text */
  textSecondary: '#9E9E9E',
  /** Muted text (e.g. "OR" separator) */
  textMuted: '#B0B0B0',
  /** Description text on modal sheets */
  sheetDescription: '#475467',
  /** Link color (e.g. Sign Up Here) */
  link: '#7C3AED',
  /** White */
  white: '#FFFFFF',
  /** Screen background */
  background: '#F2F2F2',
  /** Input field background */
  inputBackground: '#F9F9F9',
  /** Input / button borders */
  border: '#EDEDED',
  /** Outline button border (e.g. Employee ID, Phone) */
  outlineButtonBorder: '#E6E6E6',
  /** Checkbox checked fill */
  checkboxChecked: '#095CD7',
  /** Black */
  black: '#000000',
  /** Divider */
  divider: '#D0D5DD',
} as const;

export type AppColors = typeof COLORS;
