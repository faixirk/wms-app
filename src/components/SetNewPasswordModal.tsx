import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import Input from './Input';
import Button from './Button';
import PassLeftIcon from '../assets/svgs/pass_left_icon.svg';
import EyeIcon from '../assets/svgs/eye.svg';
import EyeSlashIcon from '../assets/svgs/eye-slash.svg';
import ErrorIcon from '../assets/svgs/error_icon.svg';
import { setPassLogo } from '../assets/images';

export interface SetNewPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string, confirmPassword: string) => void;
  loading?: boolean;
  error?: string | null;
}

const SetNewPasswordModal = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
  error: externalError = null,
}: SetNewPasswordModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    if (visible) {
      setNewPassword('');
      setConfirmPassword('');
      setNewPasswordError('');
      setConfirmPasswordError('');
    }
  }, [visible]);

  const hasNewPasswordError = Boolean(newPasswordError || externalError);
  const hasConfirmError = Boolean(confirmPasswordError);

  const handleSubmit = () => {
    let hasError = false;
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedNew) {
      setNewPasswordError('Password is required');
      hasError = true;
    } else if (trimmedNew.length < 8) {
      setNewPasswordError('Password must be at least 8 characters');
      hasError = true;
    } else {
      setNewPasswordError('');
    }

    if (!trimmedConfirm) {
      setConfirmPasswordError('Please confirm your password');
      hasError = true;
    } else if (trimmedNew !== trimmedConfirm) {
      setConfirmPasswordError('Passwords do not match');
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasError) return;
    onSubmit(trimmedNew, trimmedConfirm);
  };

  const header = (
    <View style={styles.iconWrap}>
      <Image source={setPassLogo} style={styles.icon} />
    </View>
  );

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      header={header}
      heightFraction={0.58}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>SET A NEW PASSWORD</Text>
        <Text style={styles.description}>
          Please set a new password to secure your WMS account.
        </Text>

        <Input
          label="Password"
          placeholder="Enter New Password"
          value={newPassword}
          onChangeText={(text) => {
            setNewPassword(text);
            if (newPasswordError) setNewPasswordError('');
          }}
          leftIcon={<PassLeftIcon width={20} height={20} />}
          rightIcon={
            hasNewPasswordError ? (
              <ErrorIcon width={20} height={20} />
            ) : (
              <Pressable onPress={() => setShowNewPassword((v) => !v)} hitSlop={12}>
                {showNewPassword ? (
                  <EyeSlashIcon width={20} height={20} />
                ) : (
                  <EyeIcon width={20} height={20} />
                )}
              </Pressable>
            )
          }
          error={hasNewPasswordError}
          errorMessage={newPasswordError || externalError || ''}
          containerStyle={styles.inputContainer}
          secureTextEntry={!showNewPassword}
          editable={!loading}
        />

        <Input
          label="Confirm Password"
          placeholder="Re-Enter Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (confirmPasswordError) setConfirmPasswordError('');
          }}
          leftIcon={<PassLeftIcon width={20} height={20} />}
          rightIcon={
            hasConfirmError ? (
              <ErrorIcon width={20} height={20} />
            ) : (
              <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={12}>
                {showConfirmPassword ? (
                  <EyeSlashIcon width={20} height={20} />
                ) : (
                  <EyeIcon width={20} height={20} />
                )}
              </Pressable>
            )
          }
          error={hasConfirmError}
          errorMessage={confirmPasswordError}
          containerStyle={styles.inputContainer}
          secureTextEntry={!showConfirmPassword}
          editable={!loading}
        />

        <Button
          title={loading ? 'SUBMITTING...' : 'SUBMIT'}
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

export default SetNewPasswordModal;
