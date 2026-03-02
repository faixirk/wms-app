import React from 'react';
import {
    View, Text, StyleSheet, Modal,
    TouchableOpacity
} from 'react-native';
import { useCall } from '../context/CallContext';
import { COLORS } from '../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../constants/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';

const CallOverlay = () => {
    const { callState, callData, acceptCall, declineCall, hangupCall, toggleMic, isMicMuted } = useCall();

    if (callState === 'idle' || !callData) {
        return null; // Don't render anything when idle
    }

    const { kind, fromUsername, toUserId } = callData;
    const isIncoming = callState === 'incoming';
    const isOutgoing = callState === 'outgoing';
    const isInCall = callState === 'in-call';

    const getTitle = () => {
        if (isIncoming) return `Incoming ${kind === 'video' ? 'Video' : 'Voice'} Call`;
        if (isOutgoing) return `Calling...`;
        if (isInCall) return `In Call`;
        return '';
    };

    const getName = () => {
        if (isIncoming) return fromUsername || 'Someone';
        if (isOutgoing) return callData.toUsername || 'Participant';
        if (isInCall) return fromUsername || callData.toUsername || 'Participant';
        return 'Unknown';
    };

    return (
        <Modal transparent visible animationType="fade">
            <View style={styles.overlay}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.title}>{getTitle()}</Text>
                        <Text style={styles.name}>{getName()}</Text>
                        <Text style={styles.status}>
                            {isInCall ? 'Connected' : isOutgoing ? 'Ringing...' : 'Waiting for answer...'}
                        </Text>
                    </View>

                    <View style={styles.controls}>
                        {isIncoming && (
                            <>
                                <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={acceptCall}>
                                    <Text style={styles.buttonText}>Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={declineCall}>
                                    <Text style={styles.buttonText}>Decline</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {isOutgoing && (
                            <TouchableOpacity style={[styles.button, styles.declineButton, { width: 120 }]} onPress={hangupCall}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                        )}

                        {isInCall && (
                            <>
                                <TouchableOpacity style={[styles.button, isMicMuted ? styles.mutedButton : styles.micButton]} onPress={toggleMic}>
                                    <Text style={styles.buttonText}>{isMicMuted ? 'Unmute' : 'Mute'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={hangupCall}>
                                    <Text style={styles.buttonText}>Hang Up</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 40,
    },
    headerInfo: {
        alignItems: 'center',
        marginTop: 60,
    },
    title: {
        color: COLORS.white,
        fontFamily: FONT_HEADING,
        fontSize: 18,
        opacity: 0.8,
        marginBottom: 8,
    },
    name: {
        color: COLORS.white,
        fontFamily: FONT_HEADING,
        fontSize: 32,
        marginBottom: 8,
    },
    status: {
        color: COLORS.white,
        fontFamily: FONT_BODY,
        fontSize: 14,
        opacity: 0.6,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        marginBottom: 60,
    },
    button: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#4CAF50',
    },
    declineButton: {
        backgroundColor: '#F44336',
    },
    micButton: {
        backgroundColor: '#333',
    },
    mutedButton: {
        backgroundColor: '#666',
    },
    buttonText: {
        color: COLORS.white,
        fontFamily: FONT_BODY,
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default CallOverlay;
