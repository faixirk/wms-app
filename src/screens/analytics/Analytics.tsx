import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Analytics = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Analytics Screen</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 18,
        color: '#000',
    },
});

export default Analytics;
