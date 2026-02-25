import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ErrorIcon from '../assets/svgs/error_icon.svg';

export type StatusModalVariant = 'success' | 'error';

export interface StatusModalProps {
  visible: boolean;
  variant: StatusModalVariant;
  message: string;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
}

const SUCCESS_COLOR = '#22C55E';

const StatusModal = ({
  visible,
  variant,
  message,
  onClose,
  style,
}: StatusModalProps) => {
  const isError = variant === 'error';
  const accentColor = isError ? COLORS.error : SUCCESS_COLOR;
  const title = isError ? 'Error' : 'Success';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, style]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: accentColor + '20' }]}>
            {isError ? (
              <ErrorIcon width={40} height={40} />
            ) : (
              <View style={[styles.successIcon, { borderColor: accentColor }]} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            style={styles.messageScroll}
            contentContainerStyle={styles.messageScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: accentColor },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: 280,
    maxWidth: '85%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    alignSelf: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    width: 24,
    height: 12,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    transform: [{ rotate: '-45deg' }],
    marginBottom: -4,
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  messageScroll: {
    maxHeight: 120,
    width: '100%',
    marginBottom: 24,
  },
  messageScrollContent: {
    paddingHorizontal: 4,
  },
  message: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    fontFamily: FONT_HEADING,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default StatusModal;
