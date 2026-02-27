import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, TodaysTask, TodaysMeetings, ChatList, ChatRoom, Workspace } from '..';
import { SCREENS } from '../constants/screens';
import { useAppSelector } from '../hooks';

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
  const hasSelectedWorkspace = useAppSelector((state) => state.auth.hasSelectedWorkspace);

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={hasSelectedWorkspace ? SCREENS.MAIN_TABS : SCREENS.WORKSPACE}
    >
      <Stack.Screen name={SCREENS.WORKSPACE} component={Workspace} />
      <Stack.Screen name={SCREENS.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen name={SCREENS.TODAYS_TASK} component={TodaysTask} />
      <Stack.Screen name={SCREENS.TODAYS_MEETINGS} component={TodaysMeetings} />
      <Stack.Screen name={SCREENS.CHAT_LIST} component={ChatList} />
      <Stack.Screen name={SCREENS.CHAT_ROOM} component={ChatRoom} />
    </Stack.Navigator>
  );
};

export default MainStack;
