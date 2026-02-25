import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home } from '..';
import { SCREENS } from '../constants/screens';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: '#FFFFFF' },
  animationEnabled: true,
  gestureEnabled: false,
  detachInactiveScreens: false,
};

const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name={SCREENS.HOME} component={Home} />
    </Stack.Navigator>
  );
};

export default MainStack;
