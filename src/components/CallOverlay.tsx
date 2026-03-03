import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal,
    TouchableOpacity
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useCall } from '../context/CallContext';
import { COLORS } from '../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../constants/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatCallDuration(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const CallOverlay = () => {
    const { callState, callData, callConnectedAt, localStream, remoteStream, acceptCall, declineCall, hangupCall, toggleMic, isMicMuted } = useCall();
    const [callDurationSecs, setCallDurationSecs] = useState(0);

    const isInCall = callState === 'in-call';

    // Update call duration every second when connected (must be called unconditionally – Rules of Hooks)
    useEffect(() => {
        if (!isInCall || callConnectedAt == null) {
            setCallDurationSecs(0);
            return;
        }
        const update = () => setCallDurationSecs(Math.floor((Date.now() - callConnectedAt) / 1000));
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [isInCall, callConnectedAt]);

    if (callState === 'idle' || !callData) {
        return null; // Don't render anything when idle
    }

    const { kind, fromUsername, toUserId } = callData;
    const isIncoming = callState === 'incoming';
    const isOutgoing = callState === 'outgoing';

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

    const remoteStreamUrl = remoteStream?.toURL?.();
    const localStreamUrl = localStream?.toURL?.();

    return (
        <Modal transparent visible animationType="fade">
            <View style={styles.overlay}>
                {/* Full-screen RTCView required for native audio playback (react-native-webrtc) */}
                {isInCall && remoteStreamUrl ? (
                    <RTCView
                        style={styles.remoteStreamView}
                        streamURL={remoteStreamUrl}
                        objectFit="cover"
                        zOrder={0}
                    />
                ) : null}
                {isInCall && localStreamUrl && callData.kind === 'video' ? (
                    <RTCView
                        style={styles.localStreamView}
                        streamURL={localStreamUrl}
                        objectFit="cover"
                        mirror
                        zOrder={1}
                    />
                ) : null}
                <SafeAreaView style={[styles.container, styles.containerOnTop]}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.title}>{getTitle()}</Text>
                        <Text style={styles.name}>{getName()}</Text>
                        <Text style={styles.status}>
                            {isInCall
                                ? (callConnectedAt != null ? formatCallDuration((callDurationSecs || 0) * 1000) : 'Connected')
                                : isOutgoing
                                    ? 'Ringing...'
                                    : 'Waiting for answer...'}
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
    remoteStreamView: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        backgroundColor: '#000',
    },
    localStreamView: {
        position: 'absolute',
        top: 100,
        right: 20,
        width: 100,
        height: 140,
        borderRadius: 8,
        zIndex: 1,
        backgroundColor: '#333',
        overflow: 'hidden',
    },
    containerOnTop: {
        zIndex: 2,
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
