import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_BODY } from '../constants/fonts';
import ModalSheet from './ModalSheet';
import { workspaceSheetLogo } from '../assets/images';
import WorkspaceOptionIcon from '../assets/svgs/workspace_option_icon.svg';
import LogoutIcon from '../assets/svgs/logout.svg';
import ArrowLeftIcon from '../assets/svgs/arrow_left.svg';
import { useAppDispatch } from '../hooks';
import { logout } from '../redux/slices/auth';

export interface ProfileSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectWorkspace: () => void;
    onLogoutPress: () => void;
}

const ProfileSheet = ({ visible, onClose, onSelectWorkspace, onLogoutPress }: ProfileSheetProps) => {

    const handleLogout = () => {
        onLogoutPress();
    };

    const handleSelectWorkspace = () => {
        onClose();
        onSelectWorkspace();
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Image source={workspaceSheetLogo} style={styles.headerLogo} resizeMode="contain" />
        </View>
    );

    return (
        <ModalSheet
            visible={visible}
            onClose={onClose}
            heightFraction={0.32}
            header={renderHeader()}
            contentStyle={styles.sheetContent}
        >
            <View style={styles.content}>
                <Pressable
                    style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                    onPress={handleSelectWorkspace}
                >
                    <View style={styles.optionLeft}>
                        <WorkspaceOptionIcon width={24} height={24} />
                        <Text style={styles.optionText}>Select Workspace</Text>
                    </View>
                    <View style={styles.chevron}>
                        <ArrowLeftIcon width={16} height={16} fill={COLORS.primary} stroke={COLORS.primary} />
                    </View>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                    onPress={handleLogout}
                >
                    <View style={styles.optionLeft}>
                        <LogoutIcon width={24} height={24} />
                        <Text style={styles.optionText}>Logout</Text>
                    </View>
                    <View style={styles.chevron}>
                        <ArrowLeftIcon width={16} height={16} fill={COLORS.primary} stroke={COLORS.primary} />
                    </View>
                </Pressable>
            </View>
        </ModalSheet>
    );
};

const styles = StyleSheet.create({
    sheetContent: {
        paddingTop: 30, // Make room for overlapping logo
    },
    header: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: -40, // overlap onto the white sheet
        zIndex: 10,
    },
    headerLogo: {
        width: 100,
        height: 106,
    },
    content: {
        marginTop: 50,
        gap: 16,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F7F9FC', // Light bluish background like the screenshot
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
    },
    optionPressed: {
        opacity: 0.8,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#344054', // Dark gray color from design system
        fontWeight: '500',
    },
    chevron: {
        transform: [{ rotate: '180deg' }], // Pointing right
    },
});

export default ProfileSheet;
