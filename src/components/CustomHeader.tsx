import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_HEADING } from '../constants/fonts';
import { ArrowLeftIcon } from '../assets/svgs';

interface CustomHeaderProps {
    titlePrefix?: string; // e.g. "TODAY"
    titleSuffix?: string; // e.g. "TASK"
    onBackPress?: () => void;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ titlePrefix, titleSuffix, onBackPress }) => {
    return (
        <View style={styles.headerContainer}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={onBackPress}
                activeOpacity={0.8}
            >
                <ArrowLeftIcon width={24} height={24} />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
                <Text style={styles.titleText}>
                    {titlePrefix && <Text style={styles.titlePrefix}>{titlePrefix} </Text>}
                    {titleSuffix && <Text style={styles.titleSuffix}>{titleSuffix}</Text>}
                </Text>
            </View>

            {/* Invisible placeholder to ensure the title remains perfectly centered */}
            <View style={styles.rightPlaceholder} />
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    titleText: {
        fontFamily: FONT_HEADING,
        fontSize: 20,
        letterSpacing: -0.5,
    },
    titlePrefix: {
        color: COLORS.primary,
    },
    titleSuffix: {
        color: COLORS.black,
    },
    rightPlaceholder: {
        width: 44,
    },
});

export default CustomHeader;
