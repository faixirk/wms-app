import { StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './src/redux/store';
import Root from './src/navigations/Root';
import { COLORS } from './src/constants/colors';
import { CallProvider } from './src/context/CallContext';
import { CallOverlay } from './src/components';
import { useEffect } from 'react';
import {
  requestUserPermission,
  listenToForegroundMessages,
  setupBackgroundMessageHandler,
} from './src/services/firebase/fcm';
import { localNotificationService } from './src/services/notification/LocalNotificationService';

import { navigateToChatRoom } from './src/navigations/RemoteNavigation';
import messaging from '@react-native-firebase/messaging';

// Initialize Local Notification Service (handles taps from our local foreground/data-only pushes)
localNotificationService.configure(
  (token) => console.log('LocalNotificationService token:', token),
  (notification) => {
    console.log('LocalNotificationService tapped:', notification);
    // When a local notification is tapped, extract chatId from the userInfo / data payload
    const data = notification.data || notification.userInfo || notification;
    if (data && data.chatId) {
       navigateToChatRoom(data.chatId, data);
    }
  }
);

// Setup background handler early before the App component renders
setupBackgroundMessageHandler();

function App() {
  useEffect(() => {
    // Request permission and get token
    requestUserPermission();

    // Listen to foreground messages
    const unsubscribe = listenToForegroundMessages();

    // Clean up foreground listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Handle tapping on a standard FCM notification when app is in the background
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      if (remoteMessage.data && remoteMessage.data.chatId) {
         navigateToChatRoom(remoteMessage.data.chatId as string, remoteMessage.data);
      }
    });

    // Handle tapping on a standard FCM notification when app is completely killed
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage && remoteMessage.data && remoteMessage.data.chatId) {
          console.log('Notification caused app to open from quit state:', remoteMessage.notification);
          navigateToChatRoom(remoteMessage.data.chatId as string, remoteMessage.data);
        }
      });

    return unsubscribeOnNotificationOpenedApp;
  }, []);

  return (
    <Provider store={store}>
      <PersistGate
        loading={null}
        persistor={persistor}
      >
        <CallProvider>
          <AppContent />
          <CallOverlay />
        </CallProvider>
      </PersistGate>
    </Provider>
  );
}

function AppContent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
          <Root />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;
