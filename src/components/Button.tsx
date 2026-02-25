import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_HEADING, TYPOGRAPHY_BODY_MEDIUM } from '../constants/fonts';

export type ButtonVariant = 'primary' | 'outline';

export type ButtonTitleTypography = 'heading' | 'bodyMedium';

export interface ButtonProps {
  title: string;
  variant?: ButtonVariant;
  titleTypography?: ButtonTitleTypography;
  leftIcon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const Button = ({
  title,
  variant = 'primary',
  titleTypography = 'heading',
  leftIcon,
  onPress,
  disabled = false,
  style,
  contentStyle,
}: ButtonProps) => {
  const isPrimary = variant === 'primary';
  const useBodyTypography = titleTypography === 'bodyMedium';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <Text
          style={[
            styles.title,
            useBodyTypography && styles.titleBodyMedium,
            isPrimary ? styles.titlePrimary : styles.titleOutline,
            disabled && styles.titleDisabled,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 28,
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.outlineButtonBorder,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 16,
    fontWeight: '500',
  },
  titleBodyMedium: {
    ...TYPOGRAPHY_BODY_MEDIUM,
  },
  titlePrimary: {
    color: COLORS.white,
  },
  titleOutline: {
    color: COLORS.primary,
  },
  titleDisabled: {
    color: COLORS.textSecondary,
  },
});

export default Button;
