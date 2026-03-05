import React, { useState, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
    Text,
    Alert,
    Keyboard,
    Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
    bottomHome,
    bottomTask,
    bottomAnalytics,
    bottomSettings,
    bottomChat,
} from '../assets/images';
import { SCREENS } from '../constants/screens';
import { COLORS } from '../constants/colors';
import { FONT_BODY } from '../constants/fonts';

const { width } = Dimensions.get('window');

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();
    const isAndroid13OrAbove = Platform.OS === 'android' && (Platform.Version as number) >= 33;
    const bottomInset = isAndroid13OrAbove ? insets.bottom : 0;
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const selectedColor = COLORS.primary;
    const unselectedColor = '#9DB2CE';

    const getIcon = (routeName: string) => {
        switch (routeName) {
            case SCREENS.HOME:
                return bottomHome;
            case SCREENS.TASKS:
                return bottomTask;
            case SCREENS.CHAT_LIST:
                return bottomChat;
            case SCREENS.SETTINGS:
                return bottomSettings;
            default:
                return bottomHome;
        }
    };

    const getLabel = (routeName: string) => {
        switch (routeName) {
            case SCREENS.HOME:
                return 'Home';
            case SCREENS.TASKS:
                return 'Tasks';
            case SCREENS.CHAT_LIST:
                return 'Chat';
            case SCREENS.SETTINGS:
                return 'Settings';
            default:
                return '';
        }
    };

    const handleFloatingButtonPress = () => {
        // Add logic for floating button here
        Alert.alert('Plus button pressed', 'Create new task action');
    };

    if (keyboardVisible) {
        return null;
    }

    return (
        <View style={[styles.container, { height: 80 + bottomInset }]}>
            <View style={[styles.svgContainer, { height: 110 + bottomInset }]}>
                <Svg width={width} height={110 + bottomInset} viewBox={`0 0 ${width} ${110 + bottomInset}`}>
                    <Path
                        d={`M0 30 L${width / 2 - 48.99} 30 A 15 15 0 0 0 ${width / 2 - 35.63} 21.82 A 40 40 0 0 1 ${width / 2 + 35.63} 21.82 A 15 15 0 0 0 ${width / 2 + 48.99} 30 L${width} 30 L${width} ${110 + bottomInset} L0 ${110 + bottomInset} Z`}
                        fill="#FFFFFF"
                    />
                </Svg>
            </View>

            <View style={[styles.tabContent, { paddingBottom: 10 + bottomInset }]}>
                {state.routes.map((route, index) => {
                    if (route.name === 'PlusButton') {
                        return (
                            <View key="floating-button" style={styles.floatingButtonContainer}>
                                <TouchableOpacity
                                    style={styles.floatingButton}
                                    // onPress={handleFloatingButtonPress}
                                    activeOpacity={0.8}>
                                    <Text style={styles.floatingButtonText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }

                    const isFocused = state.index === index;
                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tabItem}>
                            <View style={styles.iconContainer}>
                                <Image
                                    source={getIcon(route.name)}
                                    style={[
                                        styles.icon,
                                        { tintColor: isFocused ? selectedColor : unselectedColor },
                                    ]}
                                    resizeMode="contain"
                                />
                            </View>
                            {isFocused && (
                                <Text
                                    style={[
                                        styles.label,
                                        { color: isFocused ? selectedColor : unselectedColor },
                                    ]}>
                                    {getLabel(route.name)}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: width,
        height: 80,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    svgContainer: {
        position: 'absolute',
        bottom: 0,
        width: width,
        height: 110,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
    },
    tabContent: {
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 24,
        height: 24,
    },
    label: {
        fontSize: 12,
        marginTop: 3,
        fontWeight: '500',
        textAlign: 'center',
        fontFamily: FONT_BODY
    },
    floatingButtonContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        bottom: 25,
    },
    floatingButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#613EEA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    floatingButtonText: {
        fontSize: 32,
        color: '#FFFFFF',
        fontWeight: '300',
        lineHeight: 34,
    },
});

export default CustomTabBar;
