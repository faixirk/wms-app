import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING } from '../../constants/fonts';
import { emptyChatImg } from '../../assets/images';

const Settings = () => {
    return (
        <View style={styles.container}>
            <View style={styles.emptyStateContainer}>
                <Image source={emptyChatImg} style={styles.emptyStateImage} resizeMode="contain" />
                <Text style={styles.emptyStateText}>YOU DONT HAVE ANY SETTINGS TO PREVIEW</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    emptyStateImage: {
        width: 300,
        height: 200,
        marginBottom: 10,
    },
    emptyStateText: {
        fontFamily: FONT_HEADING,
        fontSize: 14,
        color: "#5A5A5A",
        textAlign: 'center',
        textTransform: 'uppercase',
    },
});

export default Settings;
