import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SCREENS } from '../constants/screens';
import { Onboarding, SignIn } from '..';
import { useAppSelector } from '../hooks';

export type AuthStackParamList = {
  [SCREENS.ONBOARDING]: undefined;
  [SCREENS.SIGN_IN]: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const screenOptions = {
  headerShown: false,
  animationEnabled: true,
};

const AuthStack = () => {
  const isFirstLaunch = useAppSelector((state) => state.auth.isFirstLaunch);

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={isFirstLaunch ? SCREENS.ONBOARDING : SCREENS.SIGN_IN}
    >
      {isFirstLaunch && <Stack.Screen name={SCREENS.ONBOARDING} component={Onboarding} />}
      <Stack.Screen name={SCREENS.SIGN_IN} component={SignIn} />
    </Stack.Navigator>
  );
};

export default AuthStack;