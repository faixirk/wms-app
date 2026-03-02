import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
    MediaStream,
} from 'react-native-webrtc';
import { socketService } from '../services/network/socket';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'in-call';
export type CallKind = 'audio' | 'video';

export interface CallData {
    callId: string;
    fromUserId: string;
    fromUsername?: string;
    toUserId?: string; // used when caller knows callee
    toUsername?: string; // name of the callee when caller initiates
    kind: CallKind;
    chatId?: string;
    workspaceId?: string;
}

interface CallContextType {
    callState: CallState;
    callData: CallData | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    startCall: (params: { workspaceId: string, chatId: string, peerUserId: string, peerUsername?: string, kind: CallKind }) => Promise<void>;
    acceptCall: () => Promise<void>;
    declineCall: () => void;
    hangupCall: () => void;
    toggleMic: () => void;
    isMicMuted: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ],
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
    const [callState, setCallState] = useState<CallState>('idle');
    const [callData, setCallData] = useState<CallData | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(false);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pendingIceRef = useRef<RTCIceCandidate[]>([]);
    const bufferedSignalsRef = useRef<any[]>([]);

    // Cleanup utility
    const cleanupCall = () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setCallState('idle');
        setCallData(null);
        setIsMicMuted(false);
        pendingIceRef.current = [];
        bufferedSignalsRef.current = [];
    };

    // Socket Listeners
    useEffect(() => {
        // 1. Backend -> Callee: Receiving an incoming call
        socketService.on('call:incoming', (incomingData: CallData) => {
            if (callState !== 'idle') {
                // Ignore if currently on another call
                return;
            }
            setCallData(incomingData);
            setCallState('incoming');
        });

        // 2. Backend -> Caller: Receiver is unavailable/offline
        socketService.on('call:unavailable', () => {
            cleanupCall();
            // Could trigger a toast/alert here
        });

        // 3. Backend -> Caller: Backend assigned a callId, caller should formulate Offer
        socketService.on('call:started', async (startedData: { callId: string, toUserId: string }) => {
            if (!pcRef.current) return;
            // Update CallData with specific callId assigned by backend
            setCallData((prev) => prev ? { ...prev, callId: startedData.callId, toUserId: startedData.toUserId } : null);

            try {
                const offer = await pcRef.current.createOffer({});
                await pcRef.current.setLocalDescription(offer);
                socketService.emit('call:signal', {
                    callId: startedData.callId,
                    type: 'offer',
                    data: offer,
                });
            } catch (err) {
                console.error('[CallContext] Failed to create offer', err);
                cleanupCall();
            }
        });

        // 4. Backend -> Callee: Caller hung up before answering
        socketService.on('call:declined', () => {
            cleanupCall();
        });

        // 5. Backend -> Both: Remote hung up
        socketService.on('call:hangup', () => {
            cleanupCall();
        });

        // 6. Backend -> Both: Receive signal (offer, answer, ICE)
        socketService.on('call:signal', async (signalRaw: any) => {

            // Extract the actual signal wrapper from backend. Sometimes payload is doubly nested.
            const signalPayload = signalRaw?.type ? signalRaw : signalRaw?.signal;
            if (!signalPayload || !signalPayload.type) return;

            const { type, data } = signalPayload;

            // If callee hasn't answered yet, buffer signals
            if (callState === 'incoming') {
                bufferedSignalsRef.current.push(signalPayload);
                return;
            }

            if (!pcRef.current) return;

            try {
                if (type === 'offer') {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
                    const answer = await pcRef.current.createAnswer();
                    await pcRef.current.setLocalDescription(answer);
                    socketService.emit('call:signal', {
                        callId: callData?.callId || signalRaw?.callId,
                        type: 'answer',
                        data: answer,
                    });

                    // remote desc is set, process pending ICE
                    processPendingICE();
                } else if (type === 'answer') {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
                    processPendingICE();
                    setCallState('in-call'); // The callee accepted and answered
                } else if (type === 'ice' && data) {
                    if (pcRef.current.remoteDescription) {
                        await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
                    } else {
                        pendingIceRef.current.push(new RTCIceCandidate(data));
                    }
                }
            } catch (err) {
                console.error(`[CallContext] Error handling signal ${type}:`, err);
            }
        });

        return () => {
            socketService.off('call:incoming');
            socketService.off('call:unavailable');
            socketService.off('call:started');
            socketService.off('call:declined');
            socketService.off('call:hangup');
            socketService.off('call:signal');
        };
    }, [callState, callData]);

    const processPendingICE = () => {
        if (!pcRef.current || !pcRef.current.remoteDescription) return;
        while (pendingIceRef.current.length > 0) {
            const candidate = pendingIceRef.current.shift();
            if (candidate) {
                pcRef.current.addIceCandidate(candidate).catch(() => { });
            }
        }
    };

    const setupPeerConnection = () => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate && callData?.callId) {
                socketService.emit('call:signal', {
                    callId: callData.callId,
                    type: 'ice',
                    data: event.candidate,
                });
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                cleanupCall();
            }
        };

        pcRef.current = pc;
        return pc;
    };

    const startCall = async ({ workspaceId, chatId, peerUserId, peerUsername, kind }: { workspaceId: string, chatId: string, peerUserId: string, peerUsername?: string, kind: CallKind }) => {
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: kind === 'video',
            });
            setLocalStream(stream);

            const pc = setupPeerConnection();
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            setCallData({
                callId: '', // To be filled by `call:started`
                fromUserId: 'self', // Arbitrary, backend knows us by token
                toUserId: peerUserId,
                toUsername: peerUsername,
                kind,
                chatId,
                workspaceId,
            });
            setCallState('outgoing');

            socketService.emit('call:start', {
                workspaceId,
                chatId,
                peerUserId,
                kind,
            });
        } catch (err) {
            console.error('[CallContext] startCall failed to get media', err);
            cleanupCall();
        }
    };

    const acceptCall = async () => {
        if (!callData) return;
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: callData.kind === 'video',
            });
            setLocalStream(stream);

            const pc = setupPeerConnection();
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            setCallState('in-call');
            socketService.emit('call:accept', { callId: callData.callId });

            // Process any buffered signals (specifically the offer)
            while (bufferedSignalsRef.current.length > 0) {
                const signal = bufferedSignalsRef.current.shift();
                if (signal.type === 'offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socketService.emit('call:signal', {
                        callId: callData.callId,
                        type: 'answer',
                        data: answer,
                    });
                    processPendingICE();
                } else if (signal.type === 'ice') {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                    } else {
                        pendingIceRef.current.push(new RTCIceCandidate(signal.data));
                    }
                }
            }
        } catch (err) {
            console.error('[CallContext] acceptCall failed to get media', err);
            declineCall();
        }
    };

    const declineCall = () => {
        if (callData?.callId) {
            socketService.emit('call:decline', { callId: callData.callId });
        }
        cleanupCall();
    };

    const hangupCall = () => {
        if (callData?.callId) {
            socketService.emit('call:hangup', { callId: callData.callId });
        }
        cleanupCall();
    };

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsMicMuted((prev) => !prev);
        }
    };

    return (
        <CallContext.Provider value={{
            callState,
            callData,
            localStream,
            remoteStream,
            startCall,
            acceptCall,
            declineCall,
            hangupCall,
            toggleMic,
            isMicMuted
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};
