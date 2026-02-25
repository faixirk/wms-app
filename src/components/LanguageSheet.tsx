import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, ImageSourcePropType } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import { enFlag, deFlag } from '../assets/images';

export type LanguageCode = 'en' | 'de';

const LANGUAGES: { code: LanguageCode; label: string; flag: ImageSourcePropType }[] = [
  { code: 'en', label: 'English', flag: enFlag },
  { code: 'de', label: 'German', flag: deFlag },
];

export interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedLanguage: LanguageCode;
  onSelect: (code: LanguageCode) => void;
}

const LanguageSheet = ({
  visible,
  onClose,
  selectedLanguage,
  onSelect,
}: LanguageSheetProps) => {
  const handleSelect = (code: LanguageCode) => {
    onSelect(code);
    onClose();
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.28}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Language</Text>
        {LANGUAGES.map(({ code, label, flag }) => (
          <Pressable
            key={code}
            onPress={() => handleSelect(code)}
            style={({ pressed }) => [
              styles.option,
              selectedLanguage === code && styles.optionSelected,
              pressed && styles.optionPressed,
            ]}
          >
            <Image source={flag} style={styles.flag} resizeMode="contain" />
            <Text style={styles.optionLabel}>{label}</Text>
            {selectedLanguage === code ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  optionPressed: {
    opacity: 0.9,
  },
  flag: {
    width: 24,
    height: 18,
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  checkmark: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default LanguageSheet;
