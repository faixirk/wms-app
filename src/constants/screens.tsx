export const SCREENS = {
  ONBOARDING: 'Onboarding',
  SIGN_IN: 'SignIn',
  HOME: 'Home',
  TASKS: 'Tasks',
  ANALYTICS: 'Analytics',
  SETTINGS: 'Settings',
  MAIN_TABS: 'MainTabs',
  TODAYS_TASK: 'TodaysTask',
  TODAYS_MEETINGS: 'TodaysMeetings',
} as const;

export type ScreenName = (typeof SCREENS)[keyof typeof SCREENS];
