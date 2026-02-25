import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigations/AuthStack';
import { useAppDispatch } from '../../hooks';
import { setIsFirstLaunch } from '../../redux/slices/auth';
import { FONT_BODY, FONT_HEADING } from '../../constants/fonts';
import { onboard1, onboard2, onboard3, appLogo } from '../../assets/images';
import { SCREENS } from '../../constants/screens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const THEME_COLOR = '#095CD7';

type OnboardingStep = {
  image: ImageSourcePropType;
  title: string;
  highlight: string;
};

const STEPS: OnboardingStep[] = [
  {
    image: onboard1,
    title: 'MANAGE YOUR PROJECTS WITH',
    highlight: 'WMS365',
  },
  {
    image: onboard2,
    title: 'ORGANIZE YOUR TASKS WITH',
    highlight: 'WMS365',
  },
  {
    image: onboard3,
    title: 'STAY ON TOP OF YOUR PROGRESS WITH',
    highlight: 'WMS365',
  },
];

const scale = (size: number) => {
  const baseWidth = 390;
  return (SCREEN_WIDTH / baseWidth) * size;
};

const Onboarding = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, typeof SCREENS.ONBOARDING>>();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToSignIn = () => {
    dispatch(setIsFirstLaunch(false));
    navigation.replace(SCREENS.SIGN_IN);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const onNext = () => {
    if (currentIndex < STEPS.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      goToSignIn();
    }
  };

  const onSkip = () => {
    goToSignIn();
  };

  const isLastStep = currentIndex === STEPS.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: scale(20), paddingTop: scale(12), paddingBottom: scale(16) }]}>
        <View style={styles.logoCenter} pointerEvents="box-none">
          <View style={[styles.logoBox, { width: scale(40), height: scale(40), borderRadius: scale(10) }]}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          </View>
        </View>
        <Pressable onPress={onSkip} hitSlop={12} style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}>
          <Text style={[styles.skipText, { fontFamily: FONT_BODY, fontSize: scale(15) }]}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {STEPS.map((step, index) => (
          <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.imageWrapper}>
              <Image
                source={step.image}
                style={[
                  styles.slideImage,
                  {
                    width: SCREEN_WIDTH - scale(48),
                    height: Math.min(SCREEN_HEIGHT * 0.4, scale(320)),
                    maxHeight: scale(320),
                  },
                ]}
                resizeMode="contain"
              />
            </View>
            <View style={[styles.textBlock, { paddingHorizontal: scale(24), marginTop: scale(24) }]}>
              <Text
                style={[
                  styles.title,
                  {
                    fontFamily: FONT_HEADING,
                    fontSize: scale(30),
                    lineHeight: scale(36),
                    letterSpacing: scale(30) * -0.01,
                    fontWeight: '500',
                  },
                ]}
                numberOfLines={3}
              >
                {step.title}{' '}
                <Text style={[styles.highlight, { fontFamily: FONT_HEADING, fontSize: scale(30), lineHeight: scale(36), letterSpacing: scale(30) * -0.01, fontWeight: '500' }]}>
                  {step.highlight}
                </Text>
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination & Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + scale(24), paddingHorizontal: scale(24) }]}>
        <View style={styles.pagination}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  width: scale(24),
                  height: scale(4),
                  borderRadius: 2,
                  marginHorizontal: scale(2),
                },
                index === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            styles.button,
            {
              marginTop: scale(30),
              height: scale(45),
              borderRadius: scale(28),
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, { fontFamily: FONT_HEADING, fontSize: scale(16) }]}>
            {isLastStep ? 'GET STARTED' : 'NEXT'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  logoCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '70%',
    height: '70%',
    alignSelf: 'center',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
  },
  textBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#1A1A1A',
    fontWeight: '500',
    textAlign: 'center',
  },
  highlight: {
    color: THEME_COLOR,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    backgroundColor: THEME_COLOR,
  },
  dotInactive: {
    backgroundColor: '#E0E0E0',
  },
  button: {
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: THEME_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default Onboarding;
