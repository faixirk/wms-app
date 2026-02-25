import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY } from '../constants/fonts';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  errorMessage?: string;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

function isValidIcon(node: React.ReactNode): boolean {
  return React.isValidElement(node) || typeof node === 'function';
}

const Input = ({
  label,
  leftIcon,
  rightIcon,
  error = false,
  errorMessage,
  containerStyle,
  inputStyle,
  placeholderTextColor = COLORS.textSecondary,
  ...textInputProps
}: InputProps) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          error && styles.inputWrapperError,
        ]}
      >
        {leftIcon && isValidIcon(leftIcon) ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon ? styles.inputWithRightIcon : null,
            inputStyle,
          ]}
          placeholderTextColor={placeholderTextColor}
          {...textInputProps}
        />
        {rightIcon && isValidIcon(rightIcon) ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
      </View>
      {error && errorMessage ? (
        <Text style={styles.errorText} numberOfLines={1}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  inputWrapperError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  inputWithLeftIcon: {
    paddingLeft: 4,
  },
  inputWithRightIcon: {
    paddingRight: 4,
  },
  leftIcon: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.error,
    marginTop: 6,
    marginLeft: 4,
  },
});

export default Input;
