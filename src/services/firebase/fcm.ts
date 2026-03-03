import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

/**
 * Requests notification permissions from the user. Returns the FCM token if granted.
 */
export const requestUserPermission = async (): Promise<string | null> => {
    if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
            console.log('FCM permission denied');
            return null;
        }
    }

    return getFcmToken();
};

/** Error message when APNS is unavailable (e.g. iOS Simulator). */
const NO_APNS_TOKEN_MESSAGE = 'No APNS token';

/**
 * Retrieves the Firebase Cloud Messaging device token.
 * On iOS Simulator, APNS is not available so this returns null (expected).
 */
export const getFcmToken = async (): Promise<string | null> => {
    try {
        if (!messaging().isDeviceRegisteredForRemoteMessages) {
            await messaging().registerDeviceForRemoteMessages();
        }
        const token = await messaging().getToken();
        console.log('Firebase Cloud Messaging Token:', token);
        return token;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isNoApns = message.includes(NO_APNS_TOKEN_MESSAGE) || message.includes('APNS');
        if (Platform.OS === 'ios' && isNoApns) {
            // Expected on iOS Simulator or when push isn't set up yet
            console.warn('FCM token unavailable (iOS Simulator or APNS not ready):', message);
        } else {
            console.error('Error getting FCM token:', error);
        }
        return null;
    }
};

/**
 * Listens for FCM messages while the app is in the foreground.
 * Call this in your main component or notification service initialization.
 */
export const listenToForegroundMessages = () => {
    return messaging().onMessage(async (remoteMessage) => {
        console.log('A new FCM message arrived in the foreground!', JSON.stringify(remoteMessage));
        // Handle foreground message (e.g., show a local notification)
    });
};

/**
 * Handles FCM messages when the app is in the background or quit state.
 * This should be called early in your application lifecycle, outside of any component.
 */
export const setupBackgroundMessageHandler = () => {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Message handled in the background!', remoteMessage);
    });
};
