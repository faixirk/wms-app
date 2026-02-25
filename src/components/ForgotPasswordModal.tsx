import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import Input from './Input';
import Button from './Button';
import EmailIcon from '../assets/svgs/email_icon.svg';
import ErrorIcon from '../assets/svgs/error_icon.svg';
import { forgetPassLogo } from '../assets/images';

export interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-fill email e.g. from Sign In screen */
  initialEmail?: string;
  onSubmit: (email: string) => void;
  loading?: boolean;
  error?: string | null;
}

const ForgotPasswordModal = ({
  visible,
  onClose,
  initialEmail = '',
  onSubmit,
  loading = false,
  error: externalError = null,
}: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail);
      setEmailError('');
    }
  }, [visible, initialEmail]);

  const hasEmailError = Boolean(emailError || externalError);
  const errorMessage = emailError || externalError || '';

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError('');
    onSubmit(trimmed);
  };

  const header = (
    <View style={styles.iconWrap}>
      <Image
        source={forgetPassLogo}
        style={styles.icon}
      />
    </View>
  );

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      header={header}
      heightFraction={0.50}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>FORGOT PASSWORD</Text>
        <Text style={styles.description}>
          A verification code will be sent to your email to reset your password.
        </Text>
        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError('');
          }}
          leftIcon={<EmailIcon width={20} height={20} />}
          rightIcon={hasEmailError ? <ErrorIcon width={20} height={20} /> : undefined}
          error={hasEmailError}
          errorMessage={errorMessage}
          containerStyle={styles.inputContainer}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <Button
          title={loading ? 'SENDING...' : 'SEND VERIFICATION CODE'}
          variant="primary"
          onPress={handleSubmit}
          disabled={loading}
          style={styles.button}
        />
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
    paddingHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  button: {
    width: '100%',
  },
});

export default ForgotPasswordModal;
