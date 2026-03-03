import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
    MediaStream,
} from 'react-native-webrtc';
import { socketService } from '../services/network/socket';

let InCallManager: { start: (opts: { media: string; auto: boolean }) => void; stop: () => void; setForceSpeakerphoneOn?: (on: boolean) => void } | null = null;
try {
    InCallManager = require('react-native-incall-manager').default;
} catch {
    // Optional: native module may not be linked
}

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
    /** When the call became connected (both sides), for showing call duration. */
    callConnectedAt: number | null;
    startCall: (params: { workspaceId: string, chatId: string, peerUserId: string, peerUsername?: string, kind: CallKind }) => Promise<void>;
    acceptCall: () => Promise<void>;
    declineCall: () => void;
    hangupCall: () => void;
    toggleMic: () => void;
    isMicMuted: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: ['turn:global.turn.metered.ca:443?transport=tcp', 'turn:global.turn.metered.ca:443?transport=udp'],
        username: 'YOUR_METERED_USERNAME',   // Metered dashboard se
        credential: 'YOUR_METERED_CREDENTIAL',
      },
    ],
  };

/** Request microphone (and camera for video) permission before starting/accepting a call. Returns true if granted. */
async function requestCallPermissions(kind: CallKind): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
        const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (kind === 'video') {
            perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }
        const results = await PermissionsAndroid.requestMultiple(perms);
        const audioOk = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraOk = kind !== 'video' || results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        if (!audioOk) {
            Alert.alert(
                'Microphone required',
                'Allow microphone access to make and receive voice calls.',
                [{ text: 'OK' }]
            );
            return false;
        }
        if (!cameraOk) {
            Alert.alert(
                'Camera required',
                'Allow camera access for video calls.',
                [{ text: 'OK' }]
            );
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[CallContext] requestCallPermissions', e);
        return false;
    }
}

export const CallProvider = ({ children }: { children: ReactNode }) => {
    const [callState, setCallState] = useState<CallState>('idle');
    const [callData, setCallData] = useState<CallData | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [callConnectedAt, setCallConnectedAt] = useState<number | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pendingIceRef = useRef<RTCIceCandidate[]>([]);
    const bufferedSignalsRef = useRef<any[]>([]);
    const callStateRef = useRef<CallState>(callState);
    const callDataRef = useRef<CallData | null>(callData);
    const localStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        callStateRef.current = callState;
        callDataRef.current = callData;
    }, [callState, callData]);

    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    // Cleanup utility – always use refs so socket/connection handlers see latest state
    const cleanupCall = () => {
        if (InCallManager) {
            try {
                InCallManager.stop();
            } catch (e) {
                // ignore
            }
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        setRemoteStream(null);
        setCallState('idle');
        setCallData(null);
        setCallConnectedAt(null);
        setIsMicMuted(false);
        pendingIceRef.current = [];
        bufferedSignalsRef.current = [];
    };

    const setConnected = () => {
        setCallState('in-call');
        setCallConnectedAt(Date.now());
    };

    // Socket Listeners
    useEffect(() => {
        // 1. Backend -> Callee: Receiving an incoming call
        socketService.on('call:incoming', (incomingData: CallData) => {
            if (callStateRef.current !== 'idle') {
                return;
            }
            callDataRef.current = incomingData;
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
            // Update CallData (and ref immediately so onicecandidate can send ICE with correct callId)
            const updated = callDataRef.current ? { ...callDataRef.current, callId: startedData.callId, toUserId: startedData.toUserId } : null;
            callDataRef.current = updated;
            setCallData(updated);

            try {
                const offer = await pcRef.current.createOffer({});
                await pcRef.current.setLocalDescription(offer);
                const offerData = offer && typeof (offer as any).toJSON === 'function' ? (offer as any).toJSON() : offer;
                socketService.emit('call:signal', {
                    callId: startedData.callId,
                    type: 'offer',
                    data: offerData,
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

        // 5. Backend -> Both: Remote hung up (so both sides end the call)
        socketService.on('call:hangup', () => {
            cleanupCall();
        });

        // 5b. Backend -> Caller: Callee accepted the call (so caller UI shows Connected immediately)
        socketService.on('call:accepted', () => {
            if (callStateRef.current === 'outgoing') {
                setConnected();
            }
        });

        // 6. Backend -> Both: Receive signal (offer, answer, ICE)
        socketService.on('call:signal', async (signalRaw: any) => {

            // Backend may send { type, data } at top level or { callId, signal: { type, data } }
            const signalPayload = signalRaw?.type != null ? signalRaw : signalRaw?.signal;
            if (!signalPayload || signalPayload.type == null) return;

            const type = signalPayload.type;
            let data = signalPayload.data;
            const currentState = callStateRef.current;
            const currentCallData = callDataRef.current;
            const callIdForEmit = currentCallData?.callId ?? signalRaw?.callId;

            // If callee hasn't answered yet, buffer signals (keep full payload for callId)
            if (currentState === 'incoming') {
                bufferedSignalsRef.current.push({ ...signalPayload, _callId: signalRaw?.callId });
                return;
            }

            if (!pcRef.current) return;

            try {
                if (type === 'offer') {
                    const sdpDesc = data && (data.type != null && data.sdp != null) ? data : { type: 'offer', sdp: data?.sdp ?? '' };
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdpDesc));
                    const answer = await pcRef.current.createAnswer();
                    await pcRef.current.setLocalDescription(answer);
                    const answerPayload = answer && typeof (answer as any).toJSON === 'function' ? (answer as any).toJSON() : answer;
                    socketService.emit('call:signal', {
                        callId: callIdForEmit,
                        type: 'answer',
                        data: answerPayload,
                    });

                    processPendingICE();
                } else if (type === 'answer') {
                    const sdpDesc = data && (data.type != null && data.sdp != null) ? data : { type: 'answer', sdp: data?.sdp ?? '' };
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdpDesc));
                    processPendingICE();
                    setConnected();
                } else if (type === 'ice' && data) {
                    const icePayload = data.candidate != null ? data : { candidate: data?.candidate ?? '', sdpMid: data?.sdpMid ?? null, sdpMLineIndex: data?.sdpMLineIndex ?? null };
                    const candidate = new RTCIceCandidate(icePayload);
                    if (pcRef.current.remoteDescription) {
                        await pcRef.current.addIceCandidate(candidate);
                    } else {
                        pendingIceRef.current.push(candidate);
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
            socketService.off('call:accepted');
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
        const pc = new RTCPeerConnection(ICE_SERVERS);
        const pcAny = pc as RTCPeerConnection & {
            onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
            ontrack: ((event: { streams?: MediaStream[]; track?: unknown }) => void) | null;
            onconnectionstatechange: (() => void) | null;
        };

        pcAny.onicecandidate = (event) => {
            const callId = callDataRef.current?.callId;
            if (event.candidate && callId) {
                const cand = event.candidate;
                const data = typeof cand?.toJSON === 'function' ? cand.toJSON() : cand;
                socketService.emit('call:signal', { callId, type: 'ice', data });
            }
        };

        pcAny.ontrack = (event) => {
            if (event.streams?.[0]) {
                setRemoteStream(event.streams[0]);
            } else if (event.track) {
                const track = event.track as Parameters<MediaStream['addTrack']>[0];
                setRemoteStream((prev) => {
                    const stream = prev ?? new MediaStream();
                    if (!stream.getTracks().includes(track)) stream.addTrack(track);
                    return stream;
                });
            }
        };

        pcAny.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                cleanupCall();
            }
        };

        pcRef.current = pc;
        return pc;
    };

    const startCall = async ({ workspaceId, chatId, peerUserId, peerUsername, kind }: { workspaceId: string, chatId: string, peerUserId: string, peerUsername?: string, kind: CallKind }) => {
        const hasPermission = await requestCallPermissions(kind);
        if (!hasPermission) {
            cleanupCall();
            return;
        }
        try {
            // Start audio session BEFORE getUserMedia (per react-native-webrtc / incall-manager)
            if (InCallManager) {
                try {
                    InCallManager.start({ media: kind === 'video' ? 'video' : 'audio', auto: true });
                    if (typeof InCallManager.setForceSpeakerphoneOn === 'function') {
                        InCallManager.setForceSpeakerphoneOn(true);
                    }
                    await new Promise<void>((r) => setTimeout(r, 150));
                } catch (e) {
                    // ignore
                }
            }

            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: kind === 'video' ? { facingMode: 'user' } : false,
            });
            stream.getTracks().forEach((t) => { t.enabled = true; });
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
        const hasPermission = await requestCallPermissions(callData.kind);
        if (!hasPermission) {
            declineCall();
            return;
        }
        try {
            if (InCallManager) {
                try {
                    InCallManager.start({ media: callData.kind === 'video' ? 'video' : 'audio', auto: true });
                    if (typeof InCallManager.setForceSpeakerphoneOn === 'function') {
                        InCallManager.setForceSpeakerphoneOn(true);
                    }
                    await new Promise<void>((r) => setTimeout(r, 150));
                } catch (e) {
                    // ignore
                }
            }

            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: callData.kind === 'video' ? { facingMode: 'user' } : false,
            });
            stream.getTracks().forEach((t) => { t.enabled = true; });
            setLocalStream(stream);

            const pc = setupPeerConnection();
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            setConnected();
            socketService.emit('call:accept', {
                callId: callData.callId,
                chatId: callData.chatId,
                workspaceId: callData.workspaceId,
            });

            // Process any buffered signals (specifically the offer)
            while (bufferedSignalsRef.current.length > 0) {
                const signal = bufferedSignalsRef.current.shift();
                if (signal.type === 'offer') {
                    const d = signal.data;
                    const sdpDesc = d && d.type != null && d.sdp != null ? d : { type: 'offer', sdp: d?.sdp ?? '' };
                    await pc.setRemoteDescription(new RTCSessionDescription(sdpDesc));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    const answerPayload = answer && typeof (answer as any).toJSON === 'function' ? (answer as any).toJSON() : answer;
                    socketService.emit('call:signal', {
                        callId: callData.callId,
                        type: 'answer',
                        data: answerPayload,
                    });
                    processPendingICE();
                } else if (signal.type === 'ice' && signal.data) {
                    const icePayload = signal.data.candidate != null ? signal.data : { candidate: signal.data?.candidate ?? '', sdpMid: signal.data?.sdpMid ?? null, sdpMLineIndex: signal.data?.sdpMLineIndex ?? null };
                    const candidate = new RTCIceCandidate(icePayload);
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(candidate);
                    } else {
                        pendingIceRef.current.push(candidate);
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
            callConnectedAt,
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
