import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  type TextInputProps,
} from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import Button from './Button';
import { forgetPassLogo } from '../assets/images';

const CELL_COUNT = 6;

export interface OtpVerifyModalProps {
  visible: boolean;
  onClose: () => void;
  /** Email the code was sent to (shown in description) */
  email: string;
  onSubmit: (code: string) => void;
  onResend?: () => void;
  loading?: boolean;
  resendLoading?: boolean;
  error?: string | null;
}

const autoComplete = Platform.select<TextInputProps['autoComplete']>({
  android: 'sms-otp',
  default: 'one-time-code',
});

const OtpVerifyModal = ({
  visible,
  onClose,
  email,
  onSubmit,
  onResend,
  loading = false,
  resendLoading = false,
  error: externalError = null,
}: OtpVerifyModalProps) => {
  const [value, setValue] = useState('');
  const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  useEffect(() => {
    if (visible) {
      setValue('');
    }
  }, [visible]);

  const handleSubmit = () => {
    if (value.length !== CELL_COUNT) return;
    onSubmit(value);
  };

  const header = (
    <View style={styles.iconWrap}>
      <Image source={forgetPassLogo} style={styles.icon} />
    </View>
  );

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      header={header}
      heightFraction={0.52}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>FORGOT PASSWORD</Text>
        <Text style={styles.description}>
          A reset code has been sent to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>, check your email to
          continue the password reset process.
        </Text>

        <CodeField
          ref={ref}
          {...props}
          value={value}
          onChangeText={setValue}
          cellCount={CELL_COUNT}
          rootStyle={styles.codeFieldRoot}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={autoComplete}
          renderCell={({ index, symbol, isFocused }) => (
            <View
              key={index}
              style={[styles.cell, isFocused && styles.cellFocused]}
              onLayout={getCellOnLayoutHandler(index)}
            >
              <Text
                style={[
                  styles.cellText,
                  !symbol && !isFocused && styles.cellPlaceholder,
                ]}
              >
                {symbol || (isFocused ? <Cursor cursorSymbol="|" /> : '0')}
              </Text>
            </View>
          )}
        />

        {externalError ? (
          <Text style={styles.errorText}>{externalError}</Text>
        ) : null}

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>
            Haven&apos;t received the sign in code?{' '}
          </Text>
          <Pressable
            onPress={onResend}
            disabled={resendLoading}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.resendPressed]}
          >
            <Text style={styles.resendLink}>
              {resendLoading ? 'Sending...' : 'Resend it.'}
            </Text>
          </Pressable>
        </View>

        <Button
          title={loading ? 'SUBMITTING...' : 'SUBMIT'}
          variant="primary"
          onPress={handleSubmit}
          disabled={loading || value.length !== CELL_COUNT}
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
    paddingTop: '20%',
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
  emailHighlight: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  codeFieldRoot: {
    marginBottom: 24,
    justifyContent: 'center',
    gap: 10,
  },
  cell: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellFocused: {
    borderColor: COLORS.primary,
  },
  cellText: {
    fontFamily: FONT_HEADING,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  cellPlaceholder: {
    color: COLORS.textMuted,
  },
  errorText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resendPrompt: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.text,
  },
  resendLink: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendPressed: {
    opacity: 0.8,
  },
  button: {
    width: '100%',
  },
});

export default OtpVerifyModal;
