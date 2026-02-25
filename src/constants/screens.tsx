export const SCREENS = {
  ONBOARDING: 'Onboarding',
  SIGN_IN: 'SignIn',
  HOME: 'Home',
} as const;

export type ScreenName = (typeof SCREENS)[keyof typeof SCREENS];
