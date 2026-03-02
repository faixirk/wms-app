import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';

class LocalNotificationService {
    configure = (onRegister: (token: any) => void, onNotification: (notification: any) => void) => {
        PushNotification.configure({
            // (optional) Called when Token is generated (iOS and Android)
            onRegister: function (token) {
                onRegister(token);
            },

            // (required) Called when a remote or local notification is opened or received
            onNotification: function (notification) {
                onNotification(notification);

                // (required) Called when a remote is received or opened, or local notification is opened
                if (Platform.OS === 'ios') {
                    notification.finish(PushNotificationIOS.FetchResult.NoData);
                }
            },

            // IOS ONLY (optional): default: all - Permissions to register.
            permissions: {
                alert: true,
                badge: true,
                sound: true,
            },

            // Should the initial notification be popped automatically
            // default: true
            popInitialNotification: true,

            /**
             * (optional) default: true
             * - Specified if permissions (ios) and token (android and ios) will requested or not,
             * - if not, you must call PushNotificationsHandler.requestPermissions() later
             */
            requestPermissions: Platform.OS === 'ios',
        });

        // Create default channel for Android
        PushNotification.createChannel(
            {
                channelId: "default-channel-id", // (required)
                channelName: "Default channel", // (required)
                channelDescription: "A default channel", // (optional) default: undefined.
                playSound: true, // (optional) default: true
                soundName: "default", // (optional) See `soundName` parameter of `localNotification` function
                importance: Importance.HIGH, // (optional) default: Importance.HIGH. Int value of the Android notification importance
                vibrate: true, // (optional) default: true. Creates the default vibration pattern if true.
            },
            (created) => console.log(`createChannel returned '${created}'`) // (optional) callback returns whether the channel was created, false means it already existed.
        );
    };

    unregister = () => {
        PushNotification.unregister();
    };

    showNotification = (id: string, title: string, message: string, data = {}, options = {}) => {
        PushNotification.localNotification({
            /* Android Only Properties */
            autoCancel: true,
            largeIcon: "ic_launcher",
            smallIcon: "ic_launcher",
            vibrate: true,
            vibration: 300,
            priority: "high",
            importance: "high",
            channelId: "default-channel-id",

            /* iOS and Android properties */
            id: parseInt(id) || 0,
            title: title,
            message: message,
            playSound: true,
            soundName: 'default',
            userInfo: data,
            ...options,
        });
    };

    cancelAllLocalNotifications = () => {
        if (Platform.OS === 'ios') {
            PushNotificationIOS.removeAllDeliveredNotifications();
        } else {
            PushNotification.cancelAllLocalNotifications();
        }
    };

    removeDeliveredNotificationByID = (notificationId: string) => {
        console.log('[LocalNotificationService] removeDeliveredNotificationByID:', notificationId);
        if (Platform.OS === 'ios') {
            PushNotificationIOS.removeDeliveredNotifications([notificationId]);
        } else {
            PushNotification.cancelLocalNotifications({ id: notificationId });
        }
    };
}

export const localNotificationService = new LocalNotificationService();
