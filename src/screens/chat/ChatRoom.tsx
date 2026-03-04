import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Keyboard, Platform, ActivityIndicator, Alert, PermissionsAndroid,
    Modal, Linking, Dimensions, Animated, ScrollView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { ArrowWhiteLeftIcon, CalenderBlueIcon, ChatVideoCamIcon, SendPaperplaneIcon, MicIcon, AttachmentIcon, PlayButtonIcon, StopIcon, PauseIcon, CloseIcon, PhoneIcon, CallIcon, ArrowLeftIcon, FlagHighIcon, BellIcon, EmailIcon } from '../../assets/svgs';
import { chatScreenBg, newGroupLogo } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchChatList, fetchChatMessages, ApiMessage, addMessageToRoom } from '../../redux/slices/chat';
import { socketService } from '../../services/network/socket';
import { uploadFile } from '../../services/network/upload';
import { useSound } from 'react-native-nitro-sound';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useCall } from '../../context/CallContext';
import Svg, { Path } from 'react-native-svg';

const WAVEFORM_BAR_COUNT = 15;

/** Shared ref: which audio URL is currently playing (Sound is a singleton). Only that instance should show progress. */
let currentPlayingAudioUrl: string | null = null;

/** Deterministic bar heights from url so waveform is stable and does not change on list re-render. */
function getStableWaveformHeights(seedUrl: string): number[] {
    let h = 0;
    const s = seedUrl.length;
    return Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
        h = (h + s + (i * 7) + 1) % 100;
        return Math.max(8, (h % 17) + 8);
    });
}

/** Format milliseconds as actual duration: "0:03" for 3s, "1:23" for 83s (minutes:seconds). */
function formatDurationMs(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Native may send seconds (e.g. 3.96) or ms (3960). Normalize to ms. */
function toMs(value: number): number {
    if (value <= 0) return 0;
    return value < 1000 ? Math.round(value * 1000) : Math.round(value);
}

/** Ignore initial wrong duration (e.g. native sometimes sends ~15 min first). Max 10 min. */
const MAX_REASONABLE_DURATION_MS = 10 * 60 * 1000;

const PLAYBACK_SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

/** iOS AVAudioPlayer does not support WebM. Remote .webm URLs cause OSStatus 1954115647. */
const isUnsupportedAudioFormatOnIOS = (audioUrl: string): boolean => {
    if (Platform.OS !== 'ios') return false;
    const pathWithoutQuery = (audioUrl || '').split('?')[0];
    const ext = pathWithoutQuery.split('.').pop()?.toLowerCase() ?? '';
    return ext === 'webm';
};

const AudioMessagePlayer = ({ url, isSent, duration: initialDuration = 0, messageId }: { url: string; isSent: boolean; duration?: number; messageId?: string }) => {
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(0);
    const playbackEventCountRef = useRef(0);
    const progressAnim = useRef(new Animated.Value(0)).current;

    const speed = PLAYBACK_SPEED_OPTIONS[playbackSpeedIndex];
    const { startPlayer, pausePlayer, resumePlayer, state, setPlaybackSpeed } = useSound({
        subscriptionDuration: 0.1,
        onPlayback: (e: { duration: number; currentPosition: number; ended?: boolean }) => {
            if (currentPlayingAudioUrl !== url) return;
            const durationMs = toMs(e.duration);
            let positionMs = toMs(e.currentPosition);
            if (durationMs > 0 && durationMs <= MAX_REASONABLE_DURATION_MS) {
                setPlaybackDuration(durationMs);
            }
            playbackEventCountRef.current += 1;
            if (playbackEventCountRef.current <= 1) positionMs = 0;
            const cap = durationMs > 0 && durationMs <= MAX_REASONABLE_DURATION_MS ? durationMs : MAX_REASONABLE_DURATION_MS;
            setPlaybackPosition(Math.min(positionMs, cap));
            if (e.ended) currentPlayingAudioUrl = null;
        },
        onPlaybackEnd: () => {
            if (currentPlayingAudioUrl === url) currentPlayingAudioUrl = null;
        },
    });

    const waveformHeights = useMemo(() => getStableWaveformHeights(messageId ?? url), [messageId, url]);

    const totalMs = playbackDuration > 0 ? playbackDuration : (initialDuration * 1000);
    const currentMs = playbackPosition;
    const progressRaw = totalMs > 0 ? (currentMs / totalMs) * WAVEFORM_BAR_COUNT : 0;
    const progress = Math.min(WAVEFORM_BAR_COUNT, Math.max(0, progressRaw));

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 80,
            useNativeDriver: true,
        }).start();
    }, [progress, progressAnim]);

    const playPause = async () => {
        try {
            if (state.isPlaying) {
                await pausePlayer();
            } else {
                // if (isUnsupportedAudioFormatOnIOS(url)) {
                //     Alert.alert(
                //         'Format not supported',
                //         'WebM audio cannot be played on this device. Ask the sender to send the message in a different format (e.g. from the mobile app).'
                //     );
                //     return;
                // }
                if (state.currentPosition === 0 || playbackPosition >= playbackDuration) {
                    currentPlayingAudioUrl = url;
                    setPlaybackPosition(0);
                    playbackEventCountRef.current = 0;
                    await startPlayer(url);
                    await setPlaybackSpeed(speed);
                } else {
                    currentPlayingAudioUrl = url;
                    await resumePlayer();
                }
            }
        } catch (e) {
            console.log('Playback failed', e);
        }
    };

    const cycleSpeed = () => {
        const next = (playbackSpeedIndex + 1) % PLAYBACK_SPEED_OPTIONS.length;
        setPlaybackSpeedIndex(next);
        const newSpeed = PLAYBACK_SPEED_OPTIONS[next];
        if (currentPlayingAudioUrl === url && state.isPlaying) {
            setPlaybackSpeed(newSpeed).catch(() => { });
        }
    };

    const durationLabel = totalMs > 0
        ? (state.isPlaying && currentPlayingAudioUrl === url
            ? `${formatDurationMs(currentMs)} / ${formatDurationMs(totalMs)}`
            : playbackPosition > 0
                ? `${formatDurationMs(currentMs)} / ${formatDurationMs(totalMs)}`
                : formatDurationMs(totalMs))
        : '0:00';

    const trackColor = isSent ? '#EAEAEA' : 'rgba(255,255,255,0.4)';
    const playedColor = COLORS.primary;

    return (
        <View style={styles.audioBubbleContainer}>
            <View style={styles.waveformContainer}>
                {waveformHeights.map((barHeight, i) => {
                    const fillAmount = progressAnim.interpolate({
                        inputRange: [i, i + 1],
                        outputRange: [0, 1],
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const translateX = progressAnim.interpolate({
                        inputRange: [i, i + 1],
                        outputRange: [-1, 0],
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    return (
                        <View
                            key={i}
                            style={[styles.waveformBar, { height: barHeight, backgroundColor: trackColor, opacity: 0.5 }]}
                        >
                            <Animated.View
                                style={[
                                    StyleSheet.absoluteFill,
                                    {
                                        backgroundColor: playedColor,
                                        opacity: 1,
                                        transform: [{ scaleX: fillAmount }, { translateX }],
                                    },
                                ]}
                            />
                        </View>
                    );
                })}
            </View>
            <TouchableOpacity onPress={playPause} activeOpacity={0.8} style={{
                justifyContent: 'center', alignItems: 'center', width: 28, height: 28, borderRadius: 14,
                backgroundColor: isSent ? '#EAEAEA' : 'rgba(255,255,255,0.2)'
            }}>
                {state.isPlaying && currentPlayingAudioUrl === url ? (
                    <PauseIcon width={16} height={16} color={isSent ? '#1366D9' : '#FFF'} />
                ) : (
                    <PlayButtonIcon width={28} height={28} />
                )}
            </TouchableOpacity>
            <View style={styles.audioTimeAndSpeed}>
                <Text style={{ fontSize: 10, color: isSent ? '#1366D9' : '#FFF', minWidth: 40, textAlign: 'right' }}>
                    {durationLabel}
                </Text>
                <TouchableOpacity onPress={cycleSpeed} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={styles.speedChip}>
                    <Text style={[styles.speedChipText, { color: isSent ? '#1366D9' : '#FFF' }]}>{speed}x</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const ChatRoom = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();

    // Fallback ID if not provided, though it typically should be
    const chatId = route.params?.chatId;
    const { startCall } = useCall();

    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
    const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({});
    const [callOptionsVisible, setCallOptionsVisible] = useState(false);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

    // Info Sheet Tabs state
    const [infoActiveTab, setInfoActiveTab] = useState<'Members' | 'Files' | 'Media' | 'Links'>('Members');
    const [inAppNotifEnabled, setInAppNotifEnabled] = useState(true);
    const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);

    // Typing state
    const [typingUsers, setTypingUsers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef<boolean>(false);

    // Message Status Tracking
    const [messageStatuses, setMessageStatuses] = useState<Record<string, string>>({});

    // Dynamic Keyboard Height
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const { startRecorder, stopRecorder } = useSound({
        onRecord: (e) => setRecordTime(e.currentPosition)
    });

    // Store mapping
    const { user, selectedWorkspaceId } = useAppSelector(state => state.auth);
    const { chats, activeRoomMessages, loadingMessages, onlineStatuses } = useAppSelector(state => state.chat);

    const userId = user?.id || (user?.data as any)?.id; // Resolving specific backend response nesting

    const currentChat = useMemo(() => chats.find(c => c.id === chatId), [chats, chatId]);
    const isGroup = currentChat ? currentChat.type !== 'DIRECT' : false;

    useEffect(() => {
        if (!isGroup && infoActiveTab === 'Members') {
            setInfoActiveTab('Files');
        }
    }, [isGroup, infoActiveTab]);

    const messages = activeRoomMessages[chatId] || [];
    const isLoading = loadingMessages ? (loadingMessages[chatId] || false) : false;
    const flatListRef = useRef<FlatList>(null);

    // Resolve Chat Details (for header avatar/name)
    const otherParticipant = useMemo(() => {
        if (isGroup) return undefined;
        return currentChat?.participants?.find((p: any) => p.id !== userId) || currentChat?.participants?.[0];
    }, [isGroup, currentChat, userId]);

    // Set Header Name
    const headerNameFull = isGroup
        ? (currentChat?.name || currentChat?.title || 'Group Chat')
        : (otherParticipant?.username || otherParticipant?.name || currentChat?.title || currentChat?.name || 'Chat');

    const headerName = isGroup ? headerNameFull : ((headerNameFull || '').trim().split(/\s+/)[0] || headerNameFull);

    // Set Header Avatar
    const headerAvatarUri = isGroup ? currentChat?.avatar : (currentChat?.avatar || otherParticipant?.avatar);
    const showHeaderAvatarImage = !!headerAvatarUri;
    const headerAvatarInitial = (headerName || '?').trim().charAt(0).toUpperCase() || '?';

    // Set Header Status
    const otherUserId = otherParticipant?.id;
    const isOnline = otherUserId && onlineStatuses[otherUserId]?.status === 'online';

    // Calculate online participants for group
    let onlineCount = 0;
    if (isGroup && currentChat?.participants) {
        // Include the current user if they are online (which they usually are if they are looking at the screen)
        // Check onlineStatuses for each participant
        currentChat.participants.forEach(p => {
            // we assume the current user is online or we check their status too
            if (p.id === userId || onlineStatuses[p.id]?.status === 'online') {
                onlineCount++;
            }
        });
    }

    const headerStatusText = isGroup ? `${onlineCount} online` : (isOnline ? 'Online' : 'Offline');

    useEffect(() => {
        if (!chatId || !selectedWorkspaceId) return;

        // Fetch historical messages initially
        dispatch(fetchChatMessages({ workspaceId: selectedWorkspaceId, chatId }));

        // Notify socket of room entry
        socketService.emit('chat:join', { chatId });

        // Subscribe to incoming messages
        const handleNewMessage = (data: { chatId: string, message: ApiMessage }) => {
            if (data.chatId === chatId) {
                dispatch(addMessageToRoom(data));

                // Hacky soft auto-scroll
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

                // If a new message arrives from someone, they probably stopped typing
                const newSenderId = data.message.senderId || data.message.sender?.id;
                if (newSenderId) {
                    setTypingUsers(prev => {
                        if (!prev[newSenderId]) return prev;
                        const newPrev = { ...prev };
                        clearTimeout(newPrev[newSenderId]);
                        delete newPrev[newSenderId];
                        return newPrev;
                    });
                }

                // If we get a new message from someone else while in the room, mark as read
                if (newSenderId !== userId) {
                    markRoomAsRead();
                }
            }
        };
        socketService.on('chat:message:new', handleNewMessage);

        // Subscribe to typing indicator
        const handleTyping = (data: { chatId: string, userId: string, isTyping: boolean }) => {
            if (data.chatId !== chatId) return;
            if (data.userId === userId) return; // ignore our own

            setTypingUsers(prev => {
                const newPrev = { ...prev };
                if (data.isTyping) {
                    // clear existing timeout if they're already typing
                    if (newPrev[data.userId]) {
                        clearTimeout(newPrev[data.userId]);
                    }
                    // set a new timeout to clear them out after 3 seconds forcefully
                    newPrev[data.userId] = setTimeout(() => {
                        setTypingUsers(current => {
                            const updated = { ...current };
                            delete updated[data.userId];
                            return updated;
                        });
                    }, 3000);
                } else {
                    if (newPrev[data.userId]) {
                        clearTimeout(newPrev[data.userId]);
                        delete newPrev[data.userId];
                    }
                }
                return newPrev;
            });
        };
        socketService.on('chat:typing', handleTyping);

        // Subscribe to message status events
        const handleAck = (data: { chatId: string, messageId: string, clientMessageId?: string }) => {
            if (data.chatId === chatId) {
                setMessageStatuses(prev => ({
                    ...prev,
                    [data.messageId || data.clientMessageId || '']: 'sent'
                }));
            }
        };

        const handleDelivered = (data: { chatId: string, messageId: string }) => {
            if (data.chatId === chatId) {
                setMessageStatuses(prev => ({
                    ...prev,
                    [data.messageId]: 'delivered'
                }));
            }
        };

        const handleRead = (data: { chatId: string, userId: string }) => {
            if (data.chatId === chatId && data.userId !== userId) {
                setMessageStatuses(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(key => {
                        if (next[key] === 'sent' || next[key] === 'delivered') {
                            next[key] = 'read';
                        }
                    });
                    return next;
                });
            }
        };

        socketService.on('chat:message:ack', handleAck);
        socketService.on('chat:message:delivered', handleDelivered);
        socketService.on('chat:read', handleRead);

        // Initial Read Trigger
        const markRoomAsRead = () => {
            socketService.emit('chat:read', {
                chatId,
                workspaceId: selectedWorkspaceId
            });
        };

        // Trigger read when joining
        markRoomAsRead();

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            socketService.emit('chat:leave', { chatId });
            socketService.off('chat:message:new', handleNewMessage);
            socketService.off('chat:typing', handleTyping);
            socketService.off('chat:message:ack', handleAck);
            socketService.off('chat:message:delivered', handleDelivered);
            socketService.off('chat:read', handleRead);
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, [chatId, selectedWorkspaceId, dispatch]);

    const emitTypingState = (isTyping: boolean) => {
        if (isTypingRef.current !== isTyping) {
            isTypingRef.current = isTyping;
            socketService.emit('chat:typing', {
                chatId,
                workspaceId: selectedWorkspaceId,
                isTyping
            });
        }
    };

    const handleMessageChange = (text: string) => {
        setMessage(text);
        if (text.length > 0) {
            emitTypingState(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                emitTypingState(false);
            }, 3000);
        } else {
            // Emptied input
            emitTypingState(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleSendMessage = () => {
        if (!message.trim() && !uploading) return;

        const clientMsgId = Date.now().toString();

        // Optimistically track sending state
        setMessageStatuses(prev => ({ ...prev, [clientMsgId]: 'sending' }));

        socketService.emit('chat:message:send', {
            chatId,
            content: message.trim(),
            clientMessageId: clientMsgId,
        });

        // Cancel typing status abruptly
        emitTypingState(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        setMessage('');
    };

    const handleStartRecording = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Audio Recording Permission',
                        message: 'App needs access to your microphone to record audio.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission Denied', 'Microphone permission is required to record audio messages.');
                    return;
                }
            } catch (err) {
                console.warn(err);
                return;
            }
        }

        try {
            await startRecorder();
            setIsRecording(true);
            setRecordTime(0);
        } catch (e: any) {
            console.log('Failed to start recording', e);
            Alert.alert('Error', 'Failed to start recording: ' + (e.message || String(e)));
        }
    };

    const handleStopRecording = async () => {
        try {
            const uri = await stopRecorder();
            setIsRecording(false);
            if (!uri) return;

            setUploading(true);
            const extension = Platform.OS === 'ios' ? 'm4a' : 'mp4';
            const mimeType = Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/mp4';
            const fileName = `voice_message_${Date.now()}.${extension}`;

            let fileSize = 0;
            try {
                const stat = await ReactNativeBlobUtil.fs.stat(uri);
                fileSize = typeof stat?.size === 'number' ? stat.size : parseInt(String(stat?.size ?? 0), 10) || 0;
            } catch (_) {
                // keep 0 if stat fails (e.g. content URI on some devices)
            }

            const uploadRes = await uploadFile(uri, fileName, mimeType);

            if (uploadRes.success && uploadRes.publicUrl) {
                // Prefer size from upload (blob) so iOS voice gets correct size when stat fails
                const attachmentSize = typeof uploadRes.size === 'number' && uploadRes.size > 0
                    ? uploadRes.size
                    : fileSize;
                socketService.emit('chat:message:send', {
                    chatId,
                    attachments: [{
                        url: uploadRes.publicUrl,
                        key: uploadRes.filename,
                        name: fileName,
                        mimeType,
                        size: attachmentSize,
                        extension,
                    }],
                    clientMessageId: `audio-${Date.now()}`,
                });
            } else {
                Alert.alert('Upload Failed', 'There was an issue sending your voice message.');
            }
        } catch (e: any) {
            console.error('Failed to stop/upload recording', e);
            setIsRecording(false);
        } finally {
            setUploading(false);
        }
    };

    const handlePickAttachment = async () => {
        try {
            const result = await DocumentPicker.pickSingle({
                type: [DocumentPicker.types.allFiles],
            });

            if (!result || !result.uri) return;

            setPendingAttachment({
                uri: result.uri,
                name: result.name || 'attachment.file',
                type: result.type || 'application/octet-stream',
                size: result.size ?? undefined,
            });
        } catch (err: any) {
            if (!DocumentPicker.isCancel(err)) {
                console.error('attachment picker error', err);
                Alert.alert('Error', 'Failed to pick attachment');
            }
        }
    };

    const handleCancelPendingAttachment = () => {
        setPendingAttachment(null);
    };

    const handleSendPendingAttachment = async () => {
        if (!pendingAttachment) return;
        setUploading(true);
        try {
            const uploadRes = await uploadFile(
                pendingAttachment.uri,
                pendingAttachment.name,
                pendingAttachment.type
            );
            if (uploadRes.success && uploadRes.publicUrl) {
                socketService.emit('chat:message:send', {
                    chatId,
                    attachments: [{
                        url: uploadRes.publicUrl,
                        key: uploadRes.filename,
                        name: pendingAttachment.name,
                        mimeType: pendingAttachment.type,
                        size: pendingAttachment.size ?? 0,
                    }],
                    clientMessageId: `file-${Date.now()}`,
                });
                setPendingAttachment(null);
            } else {
                Alert.alert('Upload Failed', 'There was an issue uploading your file. Please try again.');
            }
        } catch (err: any) {
            console.error('attachment upload error', err);
            Alert.alert('Error', 'Failed to upload file.');
        } finally {
            setUploading(false);
        }
    };

    const handleOpenAttachment = (att: { url: string; mimeType?: string; name?: string }) => {
        if (!att?.url) return;
        const mime = (att.mimeType || '').toLowerCase();
        if (mime.includes('image')) {
            setPreviewImageUrl(att.url);
        } else {
            Linking.openURL(att.url).catch(() => {
                Alert.alert('Cannot Open', 'This file could not be opened. You can copy the link and open it in a browser.');
            });
        }
    };

    const renderMessage = ({ item }: { item: ApiMessage }) => {
        const isSent = (item.sender?.id || item.senderId) === userId;
        const hasAttachment = item.attachments && item.attachments.length > 0;
        const mainAttachment = hasAttachment ? item.attachments![0] : null;

        const msgTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Resolve sender for received messages
        let senderAvatar = null;
        let senderInitial = '?';

        if (!isSent) {
            // First check item.sender (if backend populates it)
            if (item.sender?.avatar) {
                senderAvatar = item.sender.avatar;
            } else if (isGroup && item.senderId && currentChat?.participants) {
                // Determine sender from participants list
                const participant = currentChat.participants.find(p => p.id === item.senderId);
                if (participant?.avatar) {
                    senderAvatar = participant.avatar;
                } else if (participant?.username || participant?.name) {
                    senderInitial = (participant.username || participant.name || '?').trim().charAt(0).toUpperCase();
                }
            } else if (otherParticipant) {
                // Fallback for direct chat or unknown backend
                senderAvatar = otherParticipant.avatar;
                senderInitial = (otherParticipant.username || otherParticipant.name || '?').trim().charAt(0).toUpperCase();
            } else if (item.sender?.username || item.sender?.name) {
                senderInitial = (item.sender.username || item.sender.name || '?').trim().charAt(0).toUpperCase();
            }
        }

        return (
            <View style={[styles.messageRow, isSent ? styles.messageRowRight : styles.messageRowLeft]}>
                {!isSent && (
                    senderAvatar ? (
                        <Image source={{ uri: senderAvatar }} style={styles.avatarSmall} />
                    ) : (
                        <View style={styles.avatarSmallPlaceholder}>
                            <Text style={styles.avatarSmallInitial}>
                                {senderInitial}
                            </Text>
                        </View>
                    )
                )}

                <View style={[
                    styles.messageBubble,
                    isSent ? styles.messageBubbleSent : styles.messageBubbleReceived
                ]}>
                    {hasAttachment && mainAttachment ? (
                        mainAttachment.mimeType?.includes('image') ? (
                            <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpenAttachment(mainAttachment)}>
                                <Image source={{ uri: mainAttachment.url }} style={{ width: 150, height: 150, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                            </TouchableOpacity>
                        ) : mainAttachment.mimeType?.includes('audio') ? (
                            <AudioMessagePlayer
                                url={mainAttachment.url}
                                isSent={isSent}
                                duration={mainAttachment.duration}
                                messageId={item.id}
                            />
                        ) : (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleOpenAttachment(mainAttachment)}
                                style={styles.fileAttachmentTouchable}
                            >
                                <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived, styles.fileAttachmentText]}>
                                    {mainAttachment.name || 'Attached File'}
                                </Text>
                            </TouchableOpacity>
                        )
                    ) : null}

                    {!!item.content && (() => {
                        const content = item.content;
                        const isLong = content.length > 150;
                        const isExpanded = expandedMessageIds[item.id];
                        const showSeeMore = isLong && !isExpanded;
                        const showSeeLess = isLong && isExpanded;
                        return (
                            <View>
                                <Text
                                    style={[
                                        styles.messageText,
                                        isSent ? styles.messageTextSent : styles.messageTextReceived
                                    ]}
                                    numberOfLines={showSeeMore ? 4 : undefined}
                                >
                                    {content}
                                </Text>
                                {(showSeeMore || showSeeLess) && (
                                    <TouchableOpacity
                                        onPress={() => setExpandedMessageIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        style={[styles.seeMoreTouchable, isSent ? styles.seeMoreTouchableSent : styles.seeMoreTouchableReceived]}
                                    >
                                        <Text style={[styles.seeMoreText, isSent ? styles.messageTextSent : styles.messageTextReceived]}>
                                            {showSeeMore ? 'See more' : 'See less'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })()}

                    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 }}>
                        <Text style={{
                            fontSize: 10,
                            color: isSent ? '#5A5A5A' : 'rgba(255,255,255,0.7)',
                            marginRight: isSent ? 4 : 0
                        }}>
                            {msgTime}
                        </Text>

                        {isSent && (() => {
                            // Backend might have `status` natively, fallback to `messageStatuses` tracker, or default to `sent`
                            const status = messageStatuses[item.id] || (item as any).status || 'sent';

                            let icon = <Text style={{ fontSize: 10, color: '#8E8E93', fontWeight: 'bold' }}>✓</Text>;

                            if (status === 'read') {
                                icon = <Text style={{ fontSize: 10, color: '#1366D9', fontWeight: 'bold' }}>✓✓</Text>;
                            } else if (status === 'delivered') {
                                icon = <Text style={{ fontSize: 10, color: '#8E8E93', fontWeight: 'bold' }}>✓✓</Text>;
                            } else if (status === 'sending') {
                                icon = <ActivityIndicator size="small" color="#8E8E93" style={{ transform: [{ scale: 0.5 }] }} />;
                            }

                            return icon;
                        })()}
                    </View>
                </View>
            </View>
        );
    };

    // --- Dynamic Chat Info Extractors ---
    const { actualFiles, actualMedia, actualLinks } = useMemo(() => {
        const files: { id: string, name: string, meta: string, url: string, date: string, mime: string }[] = [];
        const media: { id: string, name: string, meta: string, url: string, date: string, mime: string, duration?: number }[] = [];
        const links: { id: string, url: string, title: string, date: string }[] = [];

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        [...messages].reverse().forEach(msg => {
            const dateStr = new Date(msg.createdAt).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });

            // 1. Extract embedded links from content
            if (msg.content) {
                let match;
                while ((match = urlRegex.exec(msg.content)) !== null) {
                    const matchedUrl = match[1];
                    // Very basic title fallback: just show the domain or truncated url
                    let title = matchedUrl;
                    try { title = new URL(matchedUrl).hostname; } catch (e) { }

                    // De-duplicate same link in same message
                    if (!links.some(l => l.url === matchedUrl)) {
                        links.push({ id: `${msg.id}-${links.length}`, url: matchedUrl, title, date: dateStr });
                    }
                }
            }

            // 2. Extract attachments
            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach((att: any, index: number) => {
                    if (!att.url) return;

                    const mime = att.mimeType || '';
                    const sizeText = att.size ? `${(att.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown Size';
                    const name = att.name || 'document.file';

                    if (mime.includes('image') || mime.includes('audio') || mime.includes('video')) {
                        let typeStr = 'Media';
                        if (mime.includes('image')) typeStr = 'Image';
                        if (mime.includes('audio')) typeStr = 'Audio';
                        if (mime.includes('video')) typeStr = 'Video';

                        media.push({
                            id: `${msg.id}-att-${index}`,
                            name,
                            url: att.url,
                            mime,
                            date: dateStr,
                            duration: att.duration,
                            meta: `${typeStr} • ${att.duration ? 'Audio' : sizeText} • ${dateStr}`
                        });
                    } else {
                        files.push({
                            id: `${msg.id}-att-${index}`,
                            name,
                            url: att.url,
                            mime,
                            date: dateStr,
                            meta: `File • ${sizeText} • ${dateStr}`
                        });
                    }
                });
            }
        });

        return { actualFiles: files, actualMedia: media, actualLinks: links };
    }, [messages]);

    const renderInfoSheetTabs = () => {
        const tabs = isGroup ? ['Members', 'Files', 'Media', 'Links'] as const : ['Files', 'Media', 'Links'] as const;
        return (
            <View style={styles.infoTabsWrapper}>
                {tabs.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.infoTabButton, infoActiveTab === tab && styles.infoTabButtonActive]}
                        onPress={() => setInfoActiveTab(tab as any)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.infoTabText, infoActiveTab === tab && styles.infoTabTextActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderRealFiles = () => {
        if (infoActiveTab === 'Files') {
            if (actualFiles.length === 0) {
                return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontFamily: FONT_BODY, color: 'rgba(0,0,0,0.4)' }}>No files available in this chat.</Text>
                    </View>
                );
            }
            return (
                <View style={styles.mockFilesContainer}>
                    {actualFiles.map(file => (
                        <TouchableOpacity key={file.id} style={styles.mockFileItem} activeOpacity={0.7} onPress={() => handleOpenAttachment(file)}>
                            <View style={styles.mockFileIcon}>
                                <AttachmentIcon width={20} height={20} color={COLORS.black} />
                            </View>
                            <View style={styles.mockFileDetails}>
                                <Text style={styles.mockFileName} numberOfLines={1}>{file.name}</Text>
                                <Text style={styles.mockFileMeta}>{file.meta}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (infoActiveTab === 'Media') {
            if (actualMedia.length === 0) {
                return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontFamily: FONT_BODY, color: 'rgba(0,0,0,0.4)' }}>No media available in this chat.</Text>
                    </View>
                );
            }
            return (
                <View style={styles.mockFilesContainer}>
                    {actualMedia.map(media => (
                        <TouchableOpacity key={media.id} style={styles.mockFileItem} activeOpacity={0.7} onPress={() => handleOpenAttachment(media)}>
                            <View style={styles.mockFileIcon}>
                                {media.mime.includes('audio') ? (
                                    <MicIcon width={20} height={20} color={COLORS.black} />
                                ) : media.mime.includes('video') ? (
                                    <ChatVideoCamIcon width={20} height={20} color={COLORS.black} />
                                ) : (
                                    <Image source={{ uri: media.url }} style={{ width: 44, height: 44, borderRadius: 12 }} />
                                )}
                            </View>
                            <View style={styles.mockFileDetails}>
                                <Text style={styles.mockFileName} numberOfLines={1}>{media.name}</Text>
                                <Text style={styles.mockFileMeta}>{media.meta}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (infoActiveTab === 'Links') {
            if (actualLinks.length === 0) {
                return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontFamily: FONT_BODY, color: 'rgba(0,0,0,0.4)' }}>No links available in this chat.</Text>
                    </View>
                );
            }
            return (
                <View style={styles.mockFilesContainer}>
                    {actualLinks.map(link => (
                        <TouchableOpacity key={link.id} style={styles.mockFileItem} activeOpacity={0.7} onPress={() => Linking.openURL(link.url)}>
                            <View style={styles.mockFileIcon}>
                                <Text style={{ fontFamily: FONT_HEADING, fontSize: 16, color: COLORS.black }}>🔗</Text>
                            </View>
                            <View style={styles.mockFileDetails}>
                                <Text style={styles.mockFileName} numberOfLines={1}>{link.title}</Text>
                                <Text style={styles.mockFileMeta}>{link.url.length > 30 ? link.url.substring(0, 30) + '...' : link.url} • {link.date}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        return null;
    };

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const renderTypingIndicator = () => {
        const typingIds = Object.keys(typingUsers);
        if (typingIds.length === 0) return null;

        let typingText = 'typing...';

        if (isGroup && currentChat?.participants) {
            const typingNames = typingIds.map(id => {
                const participant = currentChat.participants.find(p => p.id === id);
                const fullName = participant?.username || participant?.name || 'Unknown User';
                return fullName.trim().split(/\s+/)[0];
            }).filter(Boolean);

            if (typingNames.length === 1) {
                typingText = `${typingNames[0]} is typing...`;
            } else if (typingNames.length === 2) {
                typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
            } else if (typingNames.length > 2) {
                typingText = `Multiple people are typing...`;
            }
        }

        return (
            <View style={styles.typingIndicatorContainer}>
                <Text style={styles.typingIndicatorText}>{typingText}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.background}>

                {/* Full-screen image preview modal */}
                <Modal
                    visible={!!previewImageUrl}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPreviewImageUrl(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.previewOverlay}
                        onPress={() => setPreviewImageUrl(null)}
                    >
                        <View style={styles.previewContent} pointerEvents="box-none">
                            {previewImageUrl ? (
                                <TouchableOpacity activeOpacity={1} onPress={() => setPreviewImageUrl(null)} style={styles.previewImageWrap}>
                                    <Image
                                        source={{ uri: previewImageUrl }}
                                        style={[styles.previewImage, { width: screenWidth, height: screenHeight }]}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={styles.previewCloseButton}
                                onPress={() => setPreviewImageUrl(null)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <CloseIcon width={16} height={16} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Call options bottom sheet */}
                <Modal
                    visible={callOptionsVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setCallOptionsVisible(false)}
                >
                    <View style={styles.callSheetBackdrop}>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => setCallOptionsVisible(false)}
                        />
                        <View style={styles.callSheetContent}>
                            <View style={styles.callSheetHandle} />
                            <Text style={styles.callSheetTitle}>Choose call type</Text>
                            <TouchableOpacity
                                style={styles.callSheetOption}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setCallOptionsVisible(false);
                                    if (otherUserId && selectedWorkspaceId && chatId) {
                                        startCall({
                                            workspaceId: selectedWorkspaceId,
                                            chatId,
                                            peerUserId: otherUserId,
                                            peerUsername: headerNameFull,
                                            kind: 'audio',
                                        });
                                    }
                                }}
                            >
                                <CallIcon width={20} height={20} />
                                <Text style={styles.callSheetOptionText}>Audio call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.callSheetOption}
                                activeOpacity={0.7}
                                onPress={() => {
                                }}
                            >
                                <ChatVideoCamIcon width={24} height={24} />
                                <Text style={styles.callSheetOptionText}>Video call</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Chat Info Full Screen Modal */}
                <Modal visible={isInfoModalVisible} animationType="slide" onRequestClose={() => setIsInfoModalVisible(false)}>
                    <View style={[styles.lightModalSafeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                        <View style={styles.lightModalContainer}>
                            <View style={styles.lightModalTopBar}>
                                <TouchableOpacity onPress={() => setIsInfoModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                    <CloseIcon width={24} height={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.lightModalScroll} contentContainerStyle={styles.lightModalScrollContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.infoSheetHeader}>
                                    {isGroup ? (
                                        <Image source={newGroupLogo} style={[styles.infoLargeAvatarImage, { alignSelf: 'center', marginBottom: 20 }]} />
                                    ) : (
                                        <View style={styles.infoLargeAvatarWrapper}>
                                            {showHeaderAvatarImage ? (
                                                <Image source={{ uri: headerAvatarUri }} style={styles.infoLargeAvatarImage} />
                                            ) : (
                                                <View style={[styles.infoLargeAvatarImage, styles.infoLargeAvatarPlaceholder]}>
                                                    <Text style={styles.infoLargeAvatarText}>{headerAvatarInitial}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <Text style={styles.infoNameText}>{headerNameFull}</Text>

                                    {isGroup && (
                                        <View style={styles.infoMembersBadge}>
                                            <Text style={styles.infoMembersBadgeText}>{currentChat?.participants?.length || 0} members</Text>
                                        </View>
                                    )}
                                </View>

                                {renderInfoSheetTabs()}

                                {infoActiveTab === 'Members' && isGroup && currentChat?.participants && currentChat.participants.length > 0 && (
                                    <View style={styles.infoMembersList}>
                                        {currentChat.participants.map((p: any) => {
                                            const pName = p.username || p.name || 'Unknown User';
                                            const pAvatar = p.avatar;
                                            const pRole = p.role === 'admin' ? 'Admin' : 'Member';
                                            const pInitial = pName.trim().charAt(0).toUpperCase() || '?';
                                            const pIsOnline = onlineStatuses[p.id || p.userId]?.status === 'online';

                                            return (
                                                <View key={p.id || p.userId} style={styles.infoMemberItem}>
                                                    <View style={styles.infoMemberAvatarContainer}>
                                                        {pAvatar ? (
                                                            <Image source={{ uri: pAvatar }} style={styles.infoMemberAvatar} />
                                                        ) : (
                                                            <View style={styles.infoMemberAvatarPlaceholder}>
                                                                <Text style={styles.infoMemberAvatarText}>{pInitial}</Text>
                                                            </View>
                                                        )}
                                                        <View style={[styles.infoMemberOnlineDot, { backgroundColor: pIsOnline ? '#4ADE80' : '#FDB52A' }]} />
                                                    </View>
                                                    <View style={styles.infoMemberDetails}>
                                                        <Text style={styles.infoMemberName} numberOfLines={1}>{pName}</Text>
                                                        <Text style={styles.infoMemberRole}>{pRole}</Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {renderRealFiles()}

                            </ScrollView>

                            <View style={styles.reportButtonStickyContainer}>
                                <TouchableOpacity style={styles.reportButton} activeOpacity={0.7} onPress={() => { }}>
                                    <Svg width="20" height="20" viewBox="0 0 10 10" fill="none">
                                        <Path d="M7.50837 5.13717L7.00004 4.62884C6.87921 4.52467 6.80837 4.37051 6.80421 4.19967C6.79587 4.01217 6.87087 3.82467 7.00837 3.68717L7.50837 3.18717C7.94171 2.75384 8.10421 2.33717 7.96671 2.00801C7.83337 1.68301 7.42087 1.50384 6.81254 1.50384H2.45837V1.14551C2.45837 0.974674 2.31671 0.833008 2.14587 0.833008C1.97504 0.833008 1.83337 0.974674 1.83337 1.14551V8.85384C1.83337 9.02467 1.97504 9.16634 2.14587 9.16634C2.31671 9.16634 2.45837 9.02467 2.45837 8.85384V6.82051H6.81254C7.41254 6.82051 7.81671 6.63717 7.95421 6.30801C8.09171 5.97884 7.93337 5.56634 7.50837 5.13717Z" fill="#FF453A" />
                                    </Svg>
                                    <Text style={styles.reportButtonText}>Report This Conversation</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Custom Header */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <ArrowLeftIcon width={24} height={24} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.userInfoContainer}
                        activeOpacity={0.7}
                        onPress={() => setIsInfoModalVisible(true)}
                    >
                        {!isGroup && showHeaderAvatarImage && (
                            <Image source={{ uri: headerAvatarUri }} style={styles.headerAvatar} />
                        )}
                        {!isGroup && !showHeaderAvatarImage && (
                            <View style={styles.headerAvatarPlaceholder}>
                                <Text style={styles.headerAvatarPlaceholderText}>{headerAvatarInitial}</Text>
                            </View>
                        )}

                        <View style={styles.userInfoText}>
                            <Text style={styles.userName} numberOfLines={1}>{headerName}</Text>
                            <Text style={styles.userStatus}>{headerStatusText}</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.headerActionsPill}>
                        <TouchableOpacity style={styles.actionIconPill} activeOpacity={0.7}>
                            <CalenderBlueIcon width={24} height={24} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionIconPill}
                            activeOpacity={0.7}
                            onPress={() => setCallOptionsVisible(true)}
                        >
                            <CallIcon width={20} height={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Chat List */}
                {isLoading && messages.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.white} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.chatListContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={() => (
                            <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: 40 }}>Send a message to start the conversation</Text>
                        )}
                    />
                )}

                {/* Input Area */}
                {renderTypingIndicator()}
                {Platform.OS === 'android' && Number(Platform.Version) > 33 ? (
                    <View
                        style={{ paddingBottom: keyboardHeight > 0 ? (keyboardHeight - insets.bottom + 45) : 0 }}
                    >
                        {pendingAttachment ? (
                            <View style={styles.attachmentPreviewBar}>
                                <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                                    {pendingAttachment.name}
                                </Text>
                                <TouchableOpacity
                                    onPress={handleCancelPendingAttachment}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.attachmentPreviewClose}
                                >
                                    <CloseIcon width={16} height={16} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={styles.inputContainer}>
                            <View style={styles.textInputWrapper}>
                                {isRecording ? (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginRight: 10 }} />
                                        <Text style={{ fontFamily: FONT_BODY, fontSize: 15, color: 'red' }}>
                                            Recording... {Math.floor(recordTime / 1000)}s
                                        </Text>
                                    </View>
                                ) : (
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Type Message"
                                        placeholderTextColor="#8E8E93"
                                        value={message}
                                        onChangeText={handleMessageChange}
                                        onSubmitEditing={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                    />
                                )}
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#1366D9" style={{ padding: 8 }} />
                                ) : !isRecording && (
                                    <TouchableOpacity style={styles.attachmentButton} activeOpacity={0.7} onPress={handlePickAttachment}>
                                        <AttachmentIcon width={24} height={24} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {!isRecording && (
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    activeOpacity={0.8}
                                    onPress={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                >
                                    <SendPaperplaneIcon width={24} height={24} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.iconButton, isRecording && { backgroundColor: '#1366D9' }]}
                                activeOpacity={0.8}
                                onPress={isRecording ? handleStopRecording : handleStartRecording}
                            >
                                {isRecording ? (
                                    <StopIcon width={24} height={24} />
                                ) : (
                                    <MicIcon width={24} height={24} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 55 : 20}
                    >
                        {pendingAttachment ? (
                            <View style={styles.attachmentPreviewBar}>
                                <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                                    {pendingAttachment.name}
                                </Text>
                                <TouchableOpacity
                                    onPress={handleCancelPendingAttachment}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.attachmentPreviewClose}
                                >
                                    <CloseIcon width={16} height={16} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={styles.inputContainer}>
                            <View style={styles.textInputWrapper}>
                                {isRecording ? (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginRight: 10 }} />
                                        <Text style={{ fontFamily: FONT_BODY, fontSize: 15, color: 'red' }}>
                                            Recording... {Math.floor(recordTime / 1000)}s
                                        </Text>
                                    </View>
                                ) : (
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Type Message"
                                        placeholderTextColor="#8E8E93"
                                        value={message}
                                        onChangeText={handleMessageChange}
                                        onSubmitEditing={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                    />
                                )}
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#1366D9" style={{ padding: 8 }} />
                                ) : !isRecording && (
                                    <TouchableOpacity style={styles.attachmentButton} activeOpacity={0.7} onPress={handlePickAttachment}>
                                        <AttachmentIcon width={24} height={24} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {!isRecording && (
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    activeOpacity={0.8}
                                    onPress={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                >
                                    <SendPaperplaneIcon width={24} height={24} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.iconButton, isRecording && { backgroundColor: '#1366D9' }]}
                                activeOpacity={0.8}
                                onPress={isRecording ? handleStopRecording : handleStartRecording}
                            >
                                {isRecording ? (
                                    <StopIcon width={24} height={24} />
                                ) : (
                                    <MicIcon width={24} height={24} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F7F7F9',
    },
    background: {
        flex: 1,
        backgroundColor: '#F7F7F9',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        position: 'relative',
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginLeft: 16,
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 10,
    },
    headerAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarPlaceholderText: {
        fontFamily: FONT_BODY,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    userInfoText: {
        justifyContent: 'center',
    },
    userName: {
        fontFamily: FONT_HEADING,
        fontSize: 16,
        color: COLORS.black,
    },
    userStatus: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: '#5A5A5A',
    },
    headerActionsPill: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 40,
        borderBottomLeftRadius: 40,
        paddingLeft: 20,
        paddingRight: 10,
        paddingVertical: 12,
        gap: 16,
        position: 'absolute',
        right: 0,
        height: 64,
        alignItems: 'center',
    },
    actionIconPill: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    callSheetBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    callSheetContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 12,
        paddingBottom: 34,
        paddingHorizontal: 24,
    },
    callSheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D1D1D6',
        alignSelf: 'center',
        marginBottom: 20,
    },
    callSheetTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
        color: '#1C1C1E',
        marginBottom: 16,
        textAlign: 'center',
    },
    callSheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F2F2F7',
        marginBottom: 12,
        gap: 14,
    },
    callSheetOptionText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#1C1C1E',
    },
    chatListContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        gap: 16,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    messageRowLeft: {
        justifyContent: 'flex-start',
    },
    messageRowRight: {
        justifyContent: 'flex-end',
    },
    avatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
        marginBottom: 4,
    },
    avatarSmallPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
        marginBottom: 4,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarSmallInitial: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.white,
    },
    messageBubble: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        maxWidth: '75%',
    },
    messageBubbleReceived: {
        backgroundColor: '#508BE3',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomLeftRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 0.5,
    },
    messageBubbleSent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 0.5,
    },
    messageText: {
        fontFamily: FONT_BODY,
        fontWeight: '400',
        fontSize: 16,
        lineHeight: 20,
    },
    messageTextReceived: {
        color: COLORS.white,
    },
    messageTextSent: {
        color: '#1366D9',
    },
    seeMoreTouchable: {
        alignSelf: 'flex-end',
        marginTop: 10,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    seeMoreTouchableSent: {
        backgroundColor: 'rgba(19, 102, 217, 0.12)',
    },
    seeMoreTouchableReceived: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    seeMoreText: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    audioBubbleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 8,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
    },
    waveformBar: {
        width: 2,
        backgroundColor: '#2E8B57',
        borderRadius: 1,
        overflow: 'hidden',
    },
    audioTimeAndSpeed: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 52,
    },
    speedChip: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    speedChipText: {
        fontSize: 9,
        fontWeight: '600',
    },
    fileAttachmentTouchable: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingRight: 4,
        maxWidth: '100%',
    },
    fileAttachmentText: {
        fontStyle: 'italic',
        textDecorationLine: 'underline',
        flexShrink: 1,
    },
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContent: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImageWrap: {
        flex: 1,
        width: '100%',
    },
    previewImage: {
        flex: 1,
    },
    previewCloseButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachmentPreviewBar: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        marginHorizontal: 16,
        marginBottom: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        gap: 8,
    },
    attachmentPreviewName: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: COLORS.white,
    },
    attachmentPreviewClose: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 10,
    },
    textInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 28,
        paddingHorizontal: 16,
        height: 52,
    },
    textInput: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 15,
        color: COLORS.black,
        height: '100%',
    },
    attachmentButton: {
        padding: 8,
    },
    iconButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typingIndicatorContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: 'transparent',
    },
    typingIndicatorText: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },
    infoSheetContainer: {
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 20,
    },
    infoSheetHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    infoLargeAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 16,
    },
    infoLargeAvatarPlaceholder: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoLargeAvatarText: {
        fontFamily: FONT_HEADING,
        fontSize: 32,
        color: COLORS.black,
    },
    infoOnlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 4,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    infoNameText: {
        fontFamily: FONT_HEADING,
        fontSize: 22,
        color: COLORS.black,
        marginBottom: 6,
        textAlign: 'center',
    },
    infoRoleText: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: 'rgba(0,0,0,0.6)',
    },
    infoMembersBadge: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    infoMembersBadgeText: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: COLORS.black,
    },
    infoMembersList: {
        marginBottom: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 20,
    },
    infoSectionTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
        marginBottom: 12,
        letterSpacing: 1,
    },
    infoMemberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    infoMemberAvatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    infoMemberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    infoMemberAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoMemberAvatarText: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
        color: COLORS.black,
    },
    infoMemberOnlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    infoMemberDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    infoMemberName: {
        fontFamily: FONT_BODY,
        fontWeight: '600',
        fontSize: 16,
        color: COLORS.black,
        marginBottom: 2,
    },
    infoMemberRole: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
    },
    reportButtonStickyContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
    },
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 10,
    },
    reportButtonText: {
        fontFamily: FONT_BODY,
        fontWeight: '600',
        fontSize: 16,
        color: COLORS.black,
    },
    infoTabsWrapper: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    infoTabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    infoTabButtonActive: {
        backgroundColor: COLORS.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    infoTabText: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
    },
    infoTabTextActive: {
        color: COLORS.black,
    },
    infoTogglesContainer: {
        marginBottom: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 12,
    },
    infoToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoToggleDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: 46, // align with text
    },
    infoToggleIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoToggleTextWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    infoToggleTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 15,
        color: COLORS.white,
        marginBottom: 2,
    },
    infoToggleSubtitle: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    customSwitch: {
        width: 44,
        height: 24,
        borderRadius: 12,
        padding: 2,
        justifyContent: 'center',
    },
    customSwitchOn: {
        backgroundColor: COLORS.white,
        alignItems: 'flex-end',
    },
    customSwitchOff: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'flex-start',
    },
    customSwitchThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    customSwitchThumbOn: {
        backgroundColor: COLORS.black,
    },
    customSwitchThumbOff: {
        backgroundColor: COLORS.white,
    },
    mockFilesContainer: {
        marginBottom: 24,
    },
    mockFileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    mockFileIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    mockFileDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    mockFileName: {
        fontFamily: FONT_BODY,
        fontSize: 15,
        color: COLORS.black,
        marginBottom: 4,
    },
    mockFileMeta: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
    },
    lightModalSafeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    lightModalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    lightModalTopBar: {
        height: 56,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    lightModalScroll: {
        flex: 1,
    },
    lightModalScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    infoLargeAvatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        alignSelf: 'center',
        overflow: 'hidden',
    },
    infoLargeAvatarImage: {
        width: 120,
        height: 150,
    },
});

export default ChatRoom;
