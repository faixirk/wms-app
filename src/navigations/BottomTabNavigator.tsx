import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Tasks, Analytics, Settings } from '..';
import { SCREENS } from '../constants/screens';
import { CustomTabBar } from '../components';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}>
            <Tab.Screen name={SCREENS.HOME} component={Home} />
            <Tab.Screen name={SCREENS.TASKS} component={Tasks} />
            <Tab.Screen
                name="PlusButton"
                component={Tasks} // Just a placeholder, we will handle press in CustomTabBar
                options={{
                    tabBarButton: () => null,
                }}
                listeners={{
                    tabPress: (e) => {
                        // Prevent default action
                        e.preventDefault();
                    },
                }}
            />
            <Tab.Screen name={SCREENS.ANALYTICS} component={Analytics} />
            <Tab.Screen name={SCREENS.SETTINGS} component={Settings} />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator;
