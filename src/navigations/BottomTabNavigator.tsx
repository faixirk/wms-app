import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Tasks, Analytics, Settings, ChatList } from '..';
import { SCREENS } from '../constants/screens';
import { CustomTabBar } from '../components';
import { useNavigationMode } from '../utils/useNavigationBarVisibility';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
    const navigationMode = useNavigationMode();

    const baseTabBarStyle = useMemo(
        () => [
            {
                marginBottom:
                    navigationMode === 'button' ? '6%' : ('2%' as `${number}%`),
            },
        ],
        [navigationMode],
    );

    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: baseTabBarStyle,
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
            <Tab.Screen name={SCREENS.CHAT_LIST} component={ChatList} />
            <Tab.Screen name={SCREENS.SETTINGS} component={Settings} />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator;
