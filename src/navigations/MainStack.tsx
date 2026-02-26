import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, TodaysTask, TodaysMeetings } from '..';
import { SCREENS } from '../constants/screens';

import BottomTabNavigator from './BottomTabNavigator';

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
      <Stack.Screen name={SCREENS.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen name={SCREENS.TODAYS_TASK} component={TodaysTask} />
      <Stack.Screen name={SCREENS.TODAYS_MEETINGS} component={TodaysMeetings} />
    </Stack.Navigator>
  );
};

export default MainStack;
