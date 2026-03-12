import { createNavigationContainerRef } from '@react-navigation/native';
import { SCREENS } from '../constants/screens';

export const navigationRef = createNavigationContainerRef<any>();

const navigationQueue: Array<{ name: string; params?: any }> = [];

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    // Queue it up for when the navigator mounts
    navigationQueue.push({ name, params });
  }
}

export function flushNavigationQueue() {
  while (navigationQueue.length > 0 && navigationRef.isReady()) {
    const action = navigationQueue.shift();
    if (action) {
      navigationRef.navigate(action.name, action.params);
    }
  }
}

export function navigateToChatRoom(chatId: string, payloadData?: any) {
    navigate(SCREENS.CHAT_ROOM, { chatId, notificationData: payloadData });
}
