import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
  Platform,
  Animated,
  useWindowDimensions,
  Keyboard,
} from 'react-native';

export interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Rendered above the white panel (e.g. overlapping icon). Not wrapped in padding. */
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional: prevent closing when tapping overlay */
  dismissOnOverlayPress?: boolean;
  /** Height as fraction of screen (0–1). Default 0.7 = ~70% */
  heightFraction?: number;
}

const HEADER_STRIP_HEIGHT = 48;

const ModalSheet = ({
  visible,
  onClose,
  children,
  header,
  contentStyle,
  dismissOnOverlayPress = true,
  heightFraction = 0.7,
}: ModalSheetProps) => {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight * heightFraction;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 65,
          stiffness: 300,
        }),
      ]).start();
    } else {
      keyboardOffset.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: sheetHeight,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, sheetHeight, overlayOpacity, translateY, keyboardOffset]);

  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, keyboardOffset]);

  const sheetTranslateY = Animated.subtract(translateY, keyboardOffset);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: overlayOpacity,
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissOnOverlayPress ? onClose : undefined}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              transform: [{ translateY: sheetTranslateY }],
            },
            contentStyle,
          ]}
        >
          {header ? (
            <View style={styles.headerStrip}>{header}</View>
          ) : null}
          <Pressable style={styles.sheetInner} onPress={(e) => e.stopPropagation()}>
            {children}
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
  },
  headerStrip: {
    height: HEADER_STRIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: 'hidden',
  },
});

export default ModalSheet;
