import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export type NavigationMode = 'button' | 'gesture' | 'hidden' | 'none';

/**
 * Hook to detect the Android navigation mode
 * @returns {NavigationMode} 'button' for 3-button navigation, 'gesture' for gesture navigation, 'hidden' if hidden, 'none' for iOS
 */
export const useNavigationMode = (): NavigationMode => {
  const insets = useSafeAreaInsets();
  
  if (Platform.OS === 'ios') {
    return 'none'; // iOS doesn't have a system navigation bar
  }
  
  const bottomInset = insets.bottom;
  
  // Button navigation (3-button): typically 48-56px when visible
  if (bottomInset >= 40) {
    return 'button';
  }
  
  // Gesture navigation: typically 16-24px when visible (but can be hidden)
  if (bottomInset >= 10) {
    return 'gesture';
  }
  
  // Hidden navigation bar: 0 or very small (< 10px)
  return 'hidden';
};

/**
 * Hook to detect if the device navigation bar is visible or hidden
 * @returns {boolean} true if navigation bar is visible, false if hidden
 */
export const useNavigationBarVisibility = (): boolean => {
  const navigationMode = useNavigationMode();
  
  // Navigation bar is visible if it's button or gesture mode
  return navigationMode === 'button' || navigationMode === 'gesture';
};

/**
 * Hook to detect if device uses button navigation (3-button mode)
 * @returns {boolean} true if using button navigation, false otherwise
 */
export const useIsButtonNavigation = (): boolean => {
  const navigationMode = useNavigationMode();
  return navigationMode === 'button';
};

/**
 * Hook to get the navigation bar height
 * @returns {number} The height of the navigation bar in pixels (0 if hidden)
 */
export const useNavigationBarHeight = (): number => {
  const insets = useSafeAreaInsets();
  
  if (Platform.OS === 'ios') {
    return 0; // iOS doesn't have a system navigation bar
  }
  
  // Return the bottom inset which represents the navigation bar height
  return insets.bottom;
};

