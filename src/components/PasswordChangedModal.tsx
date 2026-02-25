import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import Button from './Button';
import { passChangedLogo } from '../assets/images';

export interface PasswordChangedModalProps {
  visible: boolean;
  onClose: () => void;
}

const PasswordChangedModal = ({ visible, onClose }: PasswordChangedModalProps) => {
  const header = (
    <View style={styles.iconWrap}>
      <Image source={passChangedLogo} style={styles.icon} />
    </View>
  );

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      header={header}
      heightFraction={0.42}
    >
      <View style={styles.content}>
        <Text style={styles.title}>PASSWORD HAS BEEN CHANGED</Text>
        <Text style={styles.description}>
          To log in to your account, click the Sign in button and enter your
          email along with your new password.
        </Text>
        <Button
          title="SIGN IN"
          variant="primary"
          onPress={onClose}
          style={styles.button}
        />
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    width: 110,
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -80,
    zIndex: 1,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingTop: '25%',
    paddingBottom: 16,
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.sheetDescription,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  button: {
    width: '100%',
  },
});

export default PasswordChangedModal;
