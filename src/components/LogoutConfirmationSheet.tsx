import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY, FONT_HEADING } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import Button from './Button';
import { logoutSheetLogo } from '../assets/images';

export interface LogoutConfirmationSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const LogoutConfirmationSheet = ({ visible, onClose, onConfirm }: LogoutConfirmationSheetProps) => {

    const renderHeader = () => (
        <View style={styles.header}>
            <Image source={logoutSheetLogo} style={styles.headerLogo} resizeMode="contain" />
        </View>
    );

    return (
        <ModalSheet
            visible={visible}
            onClose={onClose}
            heightFraction={0.43}
            header={renderHeader()}
            contentStyle={styles.sheetContent}
        >
            <View style={styles.content}>
                <Text style={styles.title}>LOG OUT</Text>
                <Text style={styles.subtitle}>Are you sure you want to logout?</Text>

                <View style={styles.buttonContainer}>
                    <Button
                        title="CONFIRM"
                        onPress={onConfirm}
                        style={styles.confirmButton}
                    />
                    <Button
                        title="DECLINE"
                        variant="outline"
                        onPress={onClose}
                        style={styles.declineButton}
                        contentStyle={styles.declineButtonContent}
                    />
                </View>
            </View>
        </ModalSheet>
    );
};

const styles = StyleSheet.create({
    sheetContent: {
        paddingTop: 40,
    },
    header: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: -60, // overlap onto the white sheet
        zIndex: 10,
    },
    headerLogo: {
        width: 100,
        height: 100,
    },
    content: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontFamily: FONT_HEADING,
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.black,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: COLORS.sheetDescription,
        marginBottom: 32,
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    confirmButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
    },
    declineButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: COLORS.primary, // Make the border prominent primary color like screenshot
    },
    declineButtonContent: {
        // ensure text uses same primary color
    }
});

export default LogoutConfirmationSheet;
