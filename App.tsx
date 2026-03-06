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
