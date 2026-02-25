import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigations/AuthStack';
import { COLORS } from '../../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../../constants/fonts';
import { appLogo, enFlag, deFlag } from '../../assets/images';
import EmailIcon from '../../assets/svgs/email_icon.svg';
import PassLeftIcon from '../../assets/svgs/pass_left_icon.svg';
import EyeIcon from '../../assets/svgs/eye.svg';
import EyeSlashIcon from '../../assets/svgs/eye-slash.svg';
import ErrorIcon from '../../assets/svgs/error_icon.svg';
import ArrowDownIcon from '../../assets/svgs/arrow_down.svg';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import StatusModal from '../../components/StatusModal';
import ForgotPasswordModal from '../../components/ForgotPasswordModal';
import OtpVerifyModal from '../../components/OtpVerifyModal';
import { SCREENS } from '../../constants/screens';
import { useAppDispatch, useAppSelector } from '../../hooks';
import {
  loginUser,
  clearError,
  forgotPassword,
  verifyOtpPass,
  resetPassword,
  clearForgotPasswordError,
  clearVerifyOtpError,
  clearResetPasswordError,
  clearPasswordResetFlowToken,
} from '../../redux/slices/auth';
import SetNewPasswordModal from '../../components/SetNewPasswordModal';
import PasswordChangedModal from '../../components/PasswordChangedModal';
import LanguageSheet, { type LanguageCode } from '../../components/LanguageSheet';

const SignIn = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const {
    loading,
    error,
    forgotPasswordLoading,
    forgotPasswordError,
    verifyOtpLoading,
    verifyOtpError,
    resetPasswordLoading,
    resetPasswordError,
  } = useAppSelector((state) => state.auth);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, typeof SCREENS.SIGN_IN>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [setNewPasswordVisible, setSetNewPasswordVisible] = useState(false);
  const [passwordChangedVisible, setPasswordChangedVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  const hasEmailError = Boolean(emailError);
  const hasPasswordError = Boolean(passwordError);

  const onSignIn = () => {
    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email doesn't registered to any account");
      hasError = true;
    } else {
      setEmailError('');
    }
    if (!password.trim()) {
      setPasswordError('Password is required');
      hasError = true;
    } else {
      setPasswordError('');
    }
    if (hasError) return;
    dispatch(loginUser({ email: email.trim(), password }));
  };

  const onForgotPassword = () => {
    dispatch(clearForgotPasswordError());
    dispatch(clearPasswordResetFlowToken());
    setForgotPasswordVisible(true);
  };

  const onForgotPasswordSubmit = (forgotEmail: string) => {
    dispatch(forgotPassword({ email: forgotEmail }))
      .unwrap()
      .then(() => {
        setForgotPasswordVisible(false);
        setOtpEmail(forgotEmail);
        setOtpVisible(true);
        dispatch(clearVerifyOtpError());
      })
      .catch(() => {});
  };

  const onOtpSubmit = (code: string) => {
    dispatch(verifyOtpPass({ otp: code }))
      .unwrap()
      .then(() => {
        setOtpVisible(false);
        dispatch(clearResetPasswordError());
        setSetNewPasswordVisible(true);
      })
      .catch(() => {});
  };

  const onSetNewPasswordSubmit = (newPassword: string, confirmPassword: string) => {
    dispatch(resetPassword({ newPassword, confirmPassword }))
      .unwrap()
      .then(() => {
        setSetNewPasswordVisible(false);
        setPasswordChangedVisible(true);
      })
      .catch(() => {});
  };

  const onOtpResend = () => {
    if (!otpEmail || resendLoading) return;
    setResendLoading(true);
    dispatch(forgotPassword({ email: otpEmail }))
      .unwrap()
      .then(() => {
        setResendLoading(false);
      })
      .catch(() => {
        setResendLoading(false);
      });
  };

  const onSignInWithEmployeeId = () => {
    // TODO: navigate or modal
  };

  const onSignInWithPhone = () => {
    // TODO: navigate or modal
  };

  const onSignUp = () => {
    // TODO: navigate to Sign Up when screen exists
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Language selector */}
        <View style={styles.langRow}>
          <Pressable
            onPress={() => setLanguageSheetVisible(true)}
            style={({ pressed }) => [styles.langButton, pressed && styles.langButtonPressed]}
          >
            <Image
              source={(selectedLanguage === 'de' ? deFlag : enFlag) as ImageSourcePropType}
              style={styles.flag}
              resizeMode="contain"
            />
            <Text style={styles.langText}>
              {selectedLanguage === 'de' ? 'German' : 'English'}
            </Text>
            <View style={styles.langChevron}>
              <ArrowDownIcon width={11} height={11} />
            </View>
          </Pressable>
        </View>

        {/* Logo */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoBox}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          </View>
        </View>

        {/* Heading */}
        <Text style={styles.heading}>
          LETS SIGN <Text style={styles.headingHighlight}>YOU IN</Text>
        </Text>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            leftIcon={<EmailIcon width={20} height={20} />}
            rightIcon={hasEmailError ? <ErrorIcon width={20} height={20} /> : undefined}
            error={hasEmailError}
            errorMessage={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError('');
            }}
            leftIcon={<PassLeftIcon width={20} height={20} />}
            rightIcon={
              hasPasswordError ? (
                <ErrorIcon width={20} height={20} />
              ) : (
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
                  {showPassword ? (
                    <EyeSlashIcon width={20} height={20} />
                  ) : (
                    <EyeIcon width={20} height={20} />
                  )}
                </Pressable>
              )
            }
            error={hasPasswordError}
            errorMessage={passwordError}
            secureTextEntry={!showPassword}
          />

          <View style={styles.row}>
            <Checkbox
              checked={rememberMe}
              onToggle={() => setRememberMe((v) => !v)}
              label="Remember Me"
            />
            <Pressable onPress={onForgotPassword} hitSlop={8} style={styles.forgotLinkWrap}>
              <Text style={styles.forgotLink}>Forgot Password</Text>
            </Pressable>
          </View>

          <StatusModal
            visible={Boolean(error)}
            variant="error"
            message={
              typeof error === 'string' && !error.includes('<')
                ? error
                : 'Sign in failed. Please try again.'
            }
            onClose={() => dispatch(clearError())}
          />

          <ForgotPasswordModal
            visible={forgotPasswordVisible}
            onClose={() => {
              setForgotPasswordVisible(false);
              dispatch(clearForgotPasswordError());
            }}
            initialEmail={email}
            onSubmit={onForgotPasswordSubmit}
            loading={forgotPasswordLoading}
            error={forgotPasswordError}
          />

          <OtpVerifyModal
            visible={otpVisible}
            onClose={() => {
              setOtpVisible(false);
              dispatch(clearVerifyOtpError());
            }}
            email={otpEmail}
            onSubmit={onOtpSubmit}
            onResend={onOtpResend}
            loading={verifyOtpLoading}
            resendLoading={resendLoading}
            error={verifyOtpError}
          />

          <SetNewPasswordModal
            visible={setNewPasswordVisible}
            onClose={() => {
              setSetNewPasswordVisible(false);
              dispatch(clearResetPasswordError());
            }}
            onSubmit={onSetNewPasswordSubmit}
            loading={resetPasswordLoading}
            error={resetPasswordError}
          />

          <PasswordChangedModal
            visible={passwordChangedVisible}
            onClose={() => setPasswordChangedVisible(false)}
          />

          <LanguageSheet
            visible={languageSheetVisible}
            onClose={() => setLanguageSheetVisible(false)}
            selectedLanguage={selectedLanguage}
            onSelect={setSelectedLanguage}
          />

          <Button
            title={loading ? 'SIGNING IN...' : 'SIGN IN'}
            variant="primary"
            onPress={onSignIn}
            disabled={loading}
            style={styles.signInButton}
          />

          {/* OR */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <Button
            title="SIGN IN WITH EMPLOYEE ID"
            variant="outline"
            titleTypography="bodyMedium"
            onPress={onSignInWithEmployeeId}
            style={styles.altButton}
          />
          <Button
            title="SIGN IN WITH PHONE"
            variant="outline"
            titleTypography="bodyMedium"
            onPress={onSignInWithPhone}
            style={styles.altButton}
          />
        </View>

        {/* Sign Up */}
        <View style={styles.signUpRow}>
          <Text style={styles.signUpPrompt}>Don&apos;t have an account? </Text>
          <Pressable onPress={onSignUp} hitSlop={8}>
            <Text style={styles.signUpLink}>Sign Up Here</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  langButtonPressed: {
    opacity: 0.9,
  },
  flag: {
    width: 24,
    height: 18,
  },
  langText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  langChevron: {
    marginLeft: 2,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '70%',
    height: '70%',
  },
  heading: {
    fontFamily: FONT_HEADING,
    fontSize: 26,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
  },
  headingHighlight: {
    color: COLORS.black,
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: -4,
    gap: 12,
  },
  forgotLinkWrap: {
    flexShrink: 0,
  },
  forgotLink: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  signInButton: {
    marginBottom: 24,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  orText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  altButton: {
    marginBottom: 12,
  },
  signUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  signUpPrompt: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
  },
  signUpLink: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.link,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default SignIn;
