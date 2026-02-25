import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY } from '../constants/fonts';

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}

const Checkbox = ({ checked, onToggle, label, disabled = false }: CheckboxProps) => {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && !disabled && styles.wrapperPressed,
      ]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? (
          <Text style={styles.tick}>✓</Text>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const size = 20;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapperPressed: {
    opacity: 0.8,
  },
  box: {
    width: size,
    height: size,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  boxChecked: {
    borderColor: COLORS.checkboxChecked,
    backgroundColor: 'transparent',
  },
  tick: {
    color: COLORS.checkboxChecked,
    fontSize: 14,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
});

export default Checkbox;
