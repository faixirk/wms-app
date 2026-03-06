import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Keyboard, Platform, ActivityIndicator, Alert, PermissionsAndroid,
    Modal, Linking, Dimensions, Animated, ScrollView, PanResponder
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { ArrowWhiteLeftIcon, CalenderBlueIcon, ChatVideoCamIcon, SendPaperplaneIcon, MicIcon, AttachmentIcon, PlayButtonIcon, StopIcon, PauseIcon, CloseIcon, PhoneIcon, CallIcon, ArrowLeftIcon, FlagHighIcon, BellIcon, EmailIcon } from '../../assets/svgs';
import { Trash } from 'iconsax-react-native';
import { chatScreenBg, newGroupLogo } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchChatList, fetchChatMessages, ApiMessage, addMessageToRoom, updateMessageInRoom, removeChatFromList } from '../../redux/slices/chat';
import { socketService } from '../../services/network/socket';
import { uploadFile } from '../../services/network/upload';
import { useSound } from 'react-native-nitro-sound';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { launchImageLibrary } from 'react-native-image-picker';
import { useCall } from '../../context/CallContext';
import Svg, { Path } from 'react-native-svg';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';
import ModalSheet from '../../components/ModalSheet';
import Button from '../../components/Button';

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

    const trackColor = isSent ? 'rgba(255,255,255,0.4)' : '#EAEAEA';
    const playedColor = isSent ? COLORS.white : COLORS.primary;

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
                backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}>
                {state.isPlaying && currentPlayingAudioUrl === url ? (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isSent ? 'transparent' : COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
                        <PauseIcon width={12} height={12} color={COLORS.white} />
                    </View>
                ) : isSent ? (
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 2 }}>
                        <Path d="M9.5 8.5L16.5 12L9.5 15.5V8.5Z" fill="white" />
                    </Svg>
                ) : (
                    <PlayButtonIcon width={28} height={28} />
                )}
            </TouchableOpacity>
            <View style={styles.audioTimeAndSpeed}>
                <Text style={{ fontSize: 10, color: isSent ? '#FFF' : '#8E8E93', minWidth: 40, textAlign: 'right' }}>
                    {durationLabel}
                </Text>
                <TouchableOpacity onPress={cycleSpeed} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[styles.speedChip, { backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]}>
                    <Text style={[styles.speedChipText, { color: isSent ? '#FFF' : '#8E8E93' }]}>{speed}x</Text>
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
    const [headerOptionsVisible, setHeaderOptionsVisible] = useState(false);
    const [messageActionMessage, setMessageActionMessage] = useState<ApiMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ApiMessage | null>(null);
    const [editDraftContent, setEditDraftContent] = useState('');
    const [chatActionLoading, setChatActionLoading] = useState(false);
    const [messageActionLoading, setMessageActionLoading] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportLoading, setReportLoading] = useState(false);

    // Info Sheet Tabs state
    const [infoActiveTab, setInfoActiveTab] = useState<'Members' | 'Files' | 'Media' | 'Links'>('Members');
    const [inAppNotifEnabled, setInAppNotifEnabled] = useState(true);
    const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
    const [attachmentOptionsVisible, setAttachmentOptionsVisible] = useState(false);

    // Typing state
    const [typingUsers, setTypingUsers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});

    // Voice Recording Gestures
    const micPan = useRef(new Animated.ValueXY()).current;
    const isRecordingRef = useRef(false);
    const isCanceledRef = useRef(false);
    const SWIPE_CANCEL_THRESHOLD = -100;

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: async () => {
            isCanceledRef.current = false;

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
                if (!isRecordingRef.current) {
                    await startRecorder();
                    setIsRecording(true);
                    isRecordingRef.current = true;
                    setRecordTime(0);
                }
            } catch (e: any) {
                console.log('Failed to start recording', e);
                Alert.alert('Error', 'Failed to start recording: ' + (e.message || String(e)));
                isRecordingRef.current = false;
                setIsRecording(false);
            }
        },
        onPanResponderMove: (_, gestureState) => {
            if (isCanceledRef.current) return;

            // Only allow dragging left
            if (gestureState.dx < 0) {
                micPan.setValue({ x: gestureState.dx, y: 0 });
            }

            // If swiped far enough left, cancel
            if (gestureState.dx < SWIPE_CANCEL_THRESHOLD) {
                isCanceledRef.current = true;
                handleCancelRecording();
                Animated.spring(micPan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false,
                }).start();
            }
        },
        onPanResponderRelease: async () => {
            if (!isCanceledRef.current && isRecordingRef.current) {
                await handleStopRecording();
            }

            Animated.spring(micPan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
            }).start();
        },
        onPanResponderTerminate: () => {
            handleCancelRecording();
            Animated.spring(micPan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
            }).start();
        }
    }), []);

    const handleCancelRecording = async () => {
        if (!isRecordingRef.current) return;
        try {
            await stopRecorder(); // Just stop it and throw away the URI
        } catch (e) {
            console.log('Error canceling recording', e);
        } finally {
            isRecordingRef.current = false;
            setIsRecording(false);
            setRecordTime(0);
        }
    };
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef<boolean>(false);

    // Message Status Tracking
    const [messageStatuses, setMessageStatuses] = useState<Record<string, string>>({});
    const [participantsLastReadAt, setParticipantsLastReadAt] = useState<Record<string, string>>({});

    // Mentions Tracking
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionKeyword, setMentionKeyword] = useState<string | null>(null);

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
        if (currentChat?.participants) {
            const readAts: Record<string, string> = {};
            currentChat.participants.forEach((p: any) => {
                // Aggressively find lastReadAt in case it is nested in an ORM pivot object
                const pLastReadAt = p.lastReadAt || p.chatParticipant?.lastReadAt || p.ChatParticipant?.lastReadAt || p.pivot?.lastReadAt || p.participant?.lastReadAt;
                if (pLastReadAt && p.id !== userId) {
                    readAts[p.id] = pLastReadAt;
                }
            });
            setParticipantsLastReadAt(prev => ({ ...prev, ...readAts }));
        }
    }, [currentChat?.participants, userId]);

    useEffect(() => {
        if (!isGroup) {
            setInfoActiveTab('Files');
        }
    }, [isGroup, infoActiveTab]);

    useEffect(() => {
        if (!isGroup) {
            setMentionKeyword(null);
            return;
        }
        const textBeforeCursor = message.slice(0, cursorPosition);
        const match = textBeforeCursor.match(/(?:^|\s)@([\w.-]*)$/);
        if (match) {
            setMentionKeyword(match[1]);
        } else {
            setMentionKeyword(null);
        }
    }, [message, cursorPosition, isGroup]);

    const filteredMentions = useMemo(() => {
        if (mentionKeyword === null || !currentChat?.participants) return [];
        const keyword = mentionKeyword.toLowerCase();
        return currentChat.participants.filter((p: any) => {
            if (p.id === userId) return false;
            const name = (p.username || p.name || '').toLowerCase();
            return name.includes(keyword);
        });
    }, [mentionKeyword, currentChat?.participants, userId]);

    const handleSelectMention = (participant: any) => {
        const handle = participant.username || participant.name || 'User';
        const textBeforeCursor = message.slice(0, cursorPosition);
        const textAfterCursor = message.slice(cursorPosition);

        const newTextBefore = textBeforeCursor.replace(/(?:^|\s)@([\w.-]*)$/, (match) => {
            const leadingSpace = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
            return leadingSpace + `@${handle} `;
        });

        setMessage(newTextBefore + textAfterCursor);
        setMentionKeyword(null);
    };

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

                // Hacky soft auto-scroll to bottom (now at offset: 0 because inverted={true})
                setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);

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

        const handleRead = (data: { chatId: string, userId: string, lastReadAt?: string }) => {
            if (data.chatId === chatId && data.userId !== userId) {
                if (data.lastReadAt) {
                    setParticipantsLastReadAt(prev => ({
                        ...prev,
                        [data.userId]: data.lastReadAt!
                    }));
                } else {
                    // Fallback to older legacy logic if lastReadAt is missing
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
            }
        };

        socketService.on('chat:message:ack', handleAck);
        socketService.on('chat:message:delivered', handleDelivered);
        socketService.on('chat:read', handleRead);

        const handleMessageEdited = (data: { chatId: string; message: ApiMessage }) => {
            if (data.chatId === chatId) {
                dispatch(updateMessageInRoom({ chatId: data.chatId, message: data.message }));
            }
        };
        const handleMessageDeleted = (data: { chatId: string; message: ApiMessage }) => {
            if (data.chatId === chatId) {
                dispatch(updateMessageInRoom({ chatId: data.chatId, message: data.message }));
            }
        };
        socketService.on('chat:message:edited', handleMessageEdited);
        socketService.on('chat:message:deleted', handleMessageDeleted);

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
            socketService.off('chat:message:edited', handleMessageEdited);
            socketService.off('chat:message:deleted', handleMessageDeleted);
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

        const mentIds: string[] = [];
        if (isGroup && currentChat?.participants) {
            currentChat.participants.forEach((p: any) => {
                const handle = p.username || p.name;
                if (handle && message.includes(`@${handle}`)) {
                    mentIds.push(p.id);
                }
            });
        }

        socketService.emit('chat:message:send', {
            chatId,
            content: message.trim(),
            clientMessageId: clientMsgId,
            mentions: mentIds.length > 0 ? mentIds : undefined
        });

        // Cancel typing status abruptly
        emitTypingState(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        setMessage('');
    };

    const handleStopRecording = async () => {
        try {
            const uri = await stopRecorder();
            isRecordingRef.current = false;
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

    const handlePickAttachment = () => {
        setAttachmentOptionsVisible(true);
    };

    const handleSelectFiles = () => {
        setAttachmentOptionsVisible(false);
        setTimeout(async () => {
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
        }, 500);
    };

    const handleSelectPhotos = () => {
        setAttachmentOptionsVisible(false);
        setTimeout(async () => {
            try {
                const result = await launchImageLibrary({
                    mediaType: 'mixed',
                    quality: 0.8,
                });

                if (result.didCancel || !result.assets || result.assets.length === 0) return;

                const asset = result.assets[0];
                if (!asset.uri) return;

                const name = asset.fileName || asset.uri.split('/').pop() || 'media.file';
                setPendingAttachment({
                    uri: asset.uri,
                    name: name,
                    type: asset.type || 'application/octet-stream',
                    size: asset.fileSize ?? undefined,
                });
            } catch (err: any) {
                console.error('image picker error', err);
                Alert.alert('Error', 'Failed to pick photo/video');
            }
        }, 500);
    };

    const handleCancelPendingAttachment = () => {
        setPendingAttachment(null);
    };

    const handleArchiveChat = async () => {
        if (!chatId || !selectedWorkspaceId || chatActionLoading) return;
        setChatActionLoading(true);
        setHeaderOptionsVisible(false);
        try {
            await request({
                method: 'POST',
                url: ENDPOINTS.CHAT_ARCHIVE(chatId),
                data: { workspaceId: selectedWorkspaceId },
            });
            dispatch(fetchChatList(selectedWorkspaceId));
            navigation.goBack();
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to archive chat';
            Alert.alert('Error', msg);
        } finally {
            setChatActionLoading(false);
        }
    };

    const handleDeleteChat = () => {
        setHeaderOptionsVisible(false);
        Alert.alert(
            'Delete Chat',
            'Are you sure you want to delete this chat? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!chatId || !selectedWorkspaceId || chatActionLoading) return;
                        setChatActionLoading(true);
                        try {
                            await request({
                                method: 'POST',
                                url: ENDPOINTS.CHAT_DELETE(chatId),
                                data: { workspaceId: selectedWorkspaceId },
                            });
                            dispatch(removeChatFromList(chatId));
                            dispatch(fetchChatList(selectedWorkspaceId));
                            navigation.goBack();
                        } catch (e: any) {
                            const msg = e?.response?.data?.message || e?.message || 'Failed to delete chat';
                            Alert.alert('Error', msg);
                        } finally {
                            setChatActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const EDIT_WINDOW_MS = 5 * 60 * 1000;
    const canEditMessage = (msg: ApiMessage) => {
        const senderId = msg.sender?.id || msg.senderId;
        if (senderId !== userId) return false;
        if (msg.deletedAt) return false;
        const created = new Date(msg.createdAt).getTime();
        return Date.now() - created <= EDIT_WINDOW_MS;
    };

    const handleEditMessage = () => {
        const msg = messageActionMessage;
        setMessageActionMessage(null);
        if (!msg) return;
        setEditingMessage(msg);
        setEditDraftContent(msg.content || '');
    };

    const handleSaveEditMessage = async () => {
        const msg = editingMessage;
        if (!msg || !chatId || !selectedWorkspaceId || !editDraftContent.trim() || messageActionLoading) return;
        setMessageActionLoading(true);
        try {
            const res = await request<{ message: ApiMessage }>({
                method: 'PATCH',
                url: ENDPOINTS.CHAT_MESSAGE_EDIT(chatId, msg.id),
                data: { workspaceId: selectedWorkspaceId, content: editDraftContent.trim() },
            });
            const updated = res?.data?.message;
            if (updated) dispatch(updateMessageInRoom({ chatId, message: updated }));
            setEditingMessage(null);
            setEditDraftContent('');
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to edit message';
            Alert.alert('Error', msg);
        } finally {
            setMessageActionLoading(false);
        }
    };

    const handleDeleteMessage = async () => {
        const msg = messageActionMessage;
        setMessageActionMessage(null);
        if (!msg || !chatId || !selectedWorkspaceId || messageActionLoading) return;
        setMessageActionLoading(true);
        try {
            const res = await request<{ message: ApiMessage }>({
                method: 'POST',
                url: ENDPOINTS.CHAT_MESSAGE_DELETE(chatId, msg.id),
                data: { workspaceId: selectedWorkspaceId },
            });
            const updated = res?.data?.message;
            if (updated) dispatch(updateMessageInRoom({ chatId, message: updated }));
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to delete message';
            Alert.alert('Error', msg);
        } finally {
            setMessageActionLoading(false);
        }
    };

    const handleOpenReportModal = () => {
        setIsInfoModalVisible(false);
        setTimeout(() => setReportModalVisible(true), 350);
    };
    const handleCloseReportModal = () => {
        if (!reportLoading) {
            setReportModalVisible(false);
            setReportReason('');
        }
    };
    const handleSubmitReport = async () => {
        if (!chatId || !selectedWorkspaceId || reportLoading) return;
        const reason = reportReason.trim().slice(0, 2000);
        setReportLoading(true);
        try {
            await request({
                method: 'POST',
                url: ENDPOINTS.CHAT_REPORT(chatId),
                data: { workspaceId: selectedWorkspaceId, ...(reason ? { reason } : {}) },
            });
            setReportModalVisible(false);
            setReportReason('');
            setIsInfoModalVisible(false);
            Alert.alert('Report submitted', 'Your report has been submitted. The workspace moderators will review it.');
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to submit report';
            Alert.alert('Error', msg);
        } finally {
            setReportLoading(false);
        }
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
        const isEdited = item.isEdited === true || (!!item.updatedAt && !!item.createdAt && new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime());

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

        const isDeleted = !!item.deletedAt;
        const isOwnMessage = (item.sender?.id || item.senderId) === userId;

        return (
            <TouchableOpacity
                style={[styles.messageRow, isSent ? styles.messageRowRight : styles.messageRowLeft]}
                activeOpacity={1}
                onLongPress={isOwnMessage && !isDeleted ? () => setMessageActionMessage(item) : undefined}
            >
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
                    {isDeleted ? (
                        <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived, styles.deletedMessageText]}>
                            This message was deleted
                        </Text>
                    ) : hasAttachment && mainAttachment ? (
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
                                    {(() => {
                                        const urlPattern = `https?:\\/\\/[^\\s]+`;

                                        // Build dynamic mention regex from participants to handle spaces in names
                                        const handles = currentChat?.participants?.map((p: any) => p.username || p.name).filter(Boolean).sort((a: string, b: string) => b.length - a.length) || [];
                                        const escapedHandles = handles.map((h: string) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

                                        // Match either an exact participant handle, or fallback to single word
                                        const mentionPattern = escapedHandles.length > 0 ? `@(?:${escapedHandles})|@[\\w.-]+` : `@[\\w.-]+`;

                                        const combinedRegex = new RegExp(`(${urlPattern}|${mentionPattern})`, 'g');
                                        const exactUrlRegex = /^(https?:\/\/[^\s]+)$/;
                                        const exactMentionRegex = new RegExp(`^(${mentionPattern})$`);

                                        if (!combinedRegex.test(content)) {
                                            return content;
                                        }

                                        const parts = content.split(combinedRegex);
                                        return parts.map((part, index) => {
                                            if (exactUrlRegex.test(part)) {
                                                return (
                                                    <Text
                                                        key={index}
                                                        style={{ textDecorationLine: 'underline' }}
                                                        onPress={() => Linking.openURL(part).catch(err => console.error("Couldn't load page", err))}
                                                    >
                                                        {part}
                                                    </Text>
                                                );
                                            } else if (exactMentionRegex.test(part)) {
                                                // If there's a mentions array, you can also optionally verify if the mention text 
                                                // matches a username from the array. Here we'll uniformly style any @word as a mention
                                                // since the backend determines who actually gets notified, visually it helps to highlight it.
                                                // If needed, check `item.mentions?.includes(...)` but raw usernames might not equal the exact string.
                                                return (
                                                    <Text
                                                        key={index}
                                                        style={{ fontWeight: 'bold', color: isSent ? '#E0E0E0' : '#1366D9' }}
                                                    >
                                                        {part}
                                                    </Text>
                                                );
                                            }
                                            return <Text key={index}>{part}</Text>;
                                        });
                                    })()}
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

                    {!isDeleted && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 }}>
                            <Text style={{
                                fontSize: 10,
                                color: isSent ? 'rgba(255,255,255,0.7)' : '#5A5A5A',
                                marginRight: isSent ? 4 : 0
                            }}>
                                {msgTime}
                                {isEdited ? ' (edited)' : ''}
                            </Text>

                            {isSent && (() => {
                                const messageCreatedAt = new Date(item.createdAt).getTime();

                                // Target Participants
                                const otherParticipants = currentChat?.participants?.filter((p: any) => p.id !== userId) || [];
                                const totalOthers = otherParticipants.length || 1;

                                let readCount = 0;

                                for (const p of otherParticipants) {
                                    const pId = p.id;
                                    if (participantsLastReadAt[pId]) {
                                        const pReadAt = new Date(participantsLastReadAt[pId]).getTime();
                                        if (messageCreatedAt <= pReadAt) {
                                            readCount++;
                                        }
                                    }
                                }

                                const isReadByAll = totalOthers > 0 && readCount === totalOthers;
                                const isReadByAnyone = readCount > 0;

                                // Native fallback statuses from DB
                                const nativeIsRead = item.isRead === true;
                                const trackedStatus = messageStatuses[item.id] || (item as any).status || 'sent';

                                let finalStatus = trackedStatus;

                                // Group vs Direct Logic
                                const isRead = isGroup ? isReadByAll : (isReadByAnyone || nativeIsRead);

                                if (isRead || trackedStatus === 'read') {
                                    finalStatus = 'read';
                                } else if (trackedStatus === 'delivered') {
                                    finalStatus = 'delivered';
                                } else if (trackedStatus === 'sent') {
                                    // For historical messages, infer 'delivered' if recipient is online
                                    // In groups, ideally wait until all are delivered, but evaluating onlineCount:
                                    if (!isGroup && isOnline) {
                                        finalStatus = 'delivered';
                                    } else if (isGroup && onlineCount > 1) { // 1 is us, >1 means someone else is online
                                        // Simplified: show double grey if anyone is online in the group
                                        finalStatus = 'delivered';
                                    }
                                }

                                let icon = <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>✓</Text>;

                                if (finalStatus === 'read') {
                                    icon = <Text style={{ fontSize: 10, color: '#34B7F1', fontWeight: 'bold' }}>✓✓</Text>;
                                } else if (finalStatus === 'delivered') {
                                    icon = <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>✓✓</Text>;
                                } else if (finalStatus === 'sending') {
                                    icon = <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ transform: [{ scale: 0.5 }] }} />;
                                }

                                return icon;
                            })()}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
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
                                <TouchableOpacity style={styles.reportButton} activeOpacity={0.7} onPress={handleOpenReportModal}>
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
                        {/* <TouchableOpacity style={styles.actionIconPill} activeOpacity={0.7}>
                            <CalenderBlueIcon width={24} height={24} />
                        </TouchableOpacity> */}
                        <TouchableOpacity
                            style={styles.actionIconPill}
                            activeOpacity={0.7}
                            onPress={() => setCallOptionsVisible(true)}
                        >
                            <CallIcon width={20} height={20} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionIconPill}
                            activeOpacity={0.7}
                            onPress={() => setHeaderOptionsVisible(true)}
                        >
                            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                                <Path d="M10 11.25a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5zM10 5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5zM10 17.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" fill="#1366D9" />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Header options – modal sheet (Archive / Delete chat) */}
                <ModalSheet
                    visible={headerOptionsVisible}
                    onClose={() => setHeaderOptionsVisible(false)}
                    heightFraction={0.24}
                    dismissOnOverlayPress={!chatActionLoading}
                >
                    <Text style={styles.reportSheetTitle}>Chat options</Text>
                    <TouchableOpacity
                        style={styles.headerOptionSheetItem}
                        onPress={handleArchiveChat}
                        disabled={chatActionLoading}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.headerOptionText}>Archive chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerOptionSheetItem, styles.headerOptionSheetItemDanger]}
                        onPress={handleDeleteChat}
                        disabled={chatActionLoading}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.headerOptionTextDanger}>Delete chat</Text>
                    </TouchableOpacity>
                </ModalSheet>

                {/* Attachment Options Modal */}
                <ModalSheet
                    visible={attachmentOptionsVisible}
                    onClose={() => setAttachmentOptionsVisible(false)}
                    heightFraction={0.24}
                    dismissOnOverlayPress={true}
                >
                    <Text style={styles.reportSheetTitle}>Select Attachment</Text>
                    <TouchableOpacity
                        style={styles.headerOptionSheetItem}
                        onPress={handleSelectFiles}
                        activeOpacity={0.7}
                    >
                        <AttachmentIcon width={24} height={24} color="#000" />
                        <Text style={[styles.headerOptionText, { marginLeft: 10 }]}>Select from Files</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerOptionSheetItem}
                        onPress={handleSelectPhotos}
                        activeOpacity={0.7}
                    >
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="#000" />
                        </Svg>
                        <Text style={[styles.headerOptionText, { marginLeft: 10 }]}>Upload from Photos or Gallery</Text>
                    </TouchableOpacity>
                </ModalSheet>

                {/* Message action – modal sheet (Edit / Delete message on long-press) */}
                <ModalSheet
                    visible={!!messageActionMessage}
                    onClose={() => setMessageActionMessage(null)}
                    heightFraction={0.24}
                    dismissOnOverlayPress={!messageActionLoading}
                >
                    <Text style={styles.reportSheetTitle}>Message options</Text>
                    {messageActionMessage && canEditMessage(messageActionMessage) && (
                        <TouchableOpacity
                            style={styles.headerOptionSheetItem}
                            onPress={handleEditMessage}
                            disabled={messageActionLoading}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.headerOptionText}>Edit message</Text>
                        </TouchableOpacity>
                    )}
                    {messageActionMessage && (messageActionMessage.sender?.id || messageActionMessage.senderId) === userId && (
                        <TouchableOpacity
                            style={[styles.headerOptionSheetItem, styles.headerOptionSheetItemDanger]}
                            onPress={handleDeleteMessage}
                            disabled={messageActionLoading}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.headerOptionTextDanger}>Delete message</Text>
                        </TouchableOpacity>
                    )}
                </ModalSheet>

                {/* Edit message modal */}
                <Modal
                    visible={!!editingMessage}
                    transparent
                    animationType="fade"
                    onRequestClose={() => { setEditingMessage(null); setEditDraftContent(''); }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.headerOptionsBackdrop}
                        onPress={() => { setEditingMessage(null); setEditDraftContent(''); }}
                    >
                        <View style={styles.editMessageBox} onStartShouldSetResponder={() => true}>
                            <Text style={styles.editMessageTitle}>Edit message</Text>
                            <TextInput
                                style={styles.editMessageInput}
                                value={editDraftContent}
                                onChangeText={setEditDraftContent}
                                placeholder="Message"
                                placeholderTextColor="#8E8E93"
                                multiline
                            />
                            <View style={styles.editMessageActions}>
                                <TouchableOpacity style={styles.editMessageCancelBtn} onPress={() => { setEditingMessage(null); setEditDraftContent(''); }}>
                                    <Text style={styles.editMessageCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.editMessageSaveBtn, !editDraftContent.trim() && styles.editMessageSaveBtnDisabled]}
                                    onPress={handleSaveEditMessage}
                                    disabled={!editDraftContent.trim() || messageActionLoading}
                                >
                                    <Text style={styles.editMessageSaveText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Report chat – modal sheet (opens after detail modal closes) */}
                <ModalSheet
                    visible={reportModalVisible}
                    onClose={handleCloseReportModal}
                    heightFraction={0.26}
                    dismissOnOverlayPress={!reportLoading}
                >
                    <Text style={styles.reportSheetTitle}>Report conversation</Text>
                    <TextInput
                        style={styles.reportSheetInput}
                        value={reportReason}
                        onChangeText={(t) => setReportReason(t.slice(0, 2000))}
                        placeholder="Reason (optional, max 2000 characters)"
                        placeholderTextColor="#8E8E93"
                        multiline
                        editable={!reportLoading}
                    />
                    <View style={styles.reportSheetActions}>
                        <Button
                            title="Cancel"
                            variant="outline"
                            onPress={handleCloseReportModal}
                            disabled={reportLoading}
                            style={styles.reportSheetButton}
                        />
                        <Button
                            title={reportLoading ? 'Submitting...' : 'Submit'}
                            variant="primary"
                            onPress={handleSubmitReport}
                            disabled={reportLoading}
                            style={styles.reportSheetButton}
                        />
                    </View>
                </ModalSheet>

                {/* Chat List */}
                {isLoading && messages.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={[...messages].reverse()}
                        inverted
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.chatListContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={{ transform: [{ scaleY: -1 }] }}>
                                <Text style={{ textAlign: 'center', color: '#9e9a9acc', marginTop: 40 }}>Send a message to start the conversation</Text>
                            </View>
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
                        {mentionKeyword !== null && filteredMentions.length > 0 && (
                            <View style={styles.mentionsContainer}>
                                <FlatList
                                    keyboardShouldPersistTaps="always"
                                    data={filteredMentions}
                                    keyExtractor={(item) => item.id}
                                    style={{ maxHeight: 150 }}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.mentionItemRow}
                                            onPress={() => handleSelectMention(item)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.mentionAvatarContainer}>
                                                {item.avatar ? (
                                                    <Image source={{ uri: item.avatar }} style={styles.mentionAvatar} />
                                                ) : (
                                                    <View style={styles.mentionAvatarPlaceholder}>
                                                        <Text style={styles.mentionAvatarText}>
                                                            {(item.username || item.name || '?').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.mentionNameText}>{item.username || item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                        <View style={styles.inputContainer}>
                            <View style={styles.textInputWrapper}>
                                {isRecording ? (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Animated.View style={{ opacity: micPan.x.interpolate({ inputRange: [-100, 0], outputRange: [1, 0] }) }}>
                                                <Trash size={20} color="red" variant="Bold" style={{ marginRight: 10 }} />
                                            </Animated.View>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginRight: 10 }} />
                                            <Text style={{ fontFamily: FONT_BODY, fontSize: 15, color: '#1C1C1E' }}>
                                                {formatDurationMs(recordTime)}
                                            </Text>
                                        </View>

                                        <Animated.View style={{ opacity: micPan.x.interpolate({ inputRange: [-100, 0], outputRange: [0, 1] }), flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#8E8E93', marginRight: 15 }}>
                                                {"< Slide to cancel"}
                                            </Text>
                                        </Animated.View>
                                    </View>
                                ) : (
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Type Message"
                                        placeholderTextColor="#8E8E93"
                                        value={message}
                                        onChangeText={handleMessageChange}
                                        onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                                        onSubmitEditing={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                    />
                                )}
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#1366D9" style={{ padding: 8 }} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {!isRecording && (
                                            <TouchableOpacity style={styles.attachmentButton} activeOpacity={0.7} onPress={handlePickAttachment}>
                                                <AttachmentIcon width={24} height={24} />
                                            </TouchableOpacity>
                                        )}
                                        <Animated.View
                                            {...panResponder.panHandlers}
                                            style={[styles.attachmentButton, { transform: [{ translateX: micPan.x }] }, isRecording && { backgroundColor: '#1366D9', borderRadius: 20, padding: 4 }]}
                                        >
                                            {isRecording ? (
                                                <StopIcon width={24} height={24} color="#FFF" />
                                            ) : (
                                                <MicIcon width={24} height={24} color="#8E8E93" />
                                            )}
                                        </Animated.View>
                                    </View>
                                )}
                            </View>

                            {!isRecording && (message.trim().length > 0 || pendingAttachment) && (
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    activeOpacity={0.8}
                                    onPress={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                >
                                    <SendPaperplaneIcon width={24} height={24} />
                                </TouchableOpacity>
                            )}
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
                        {mentionKeyword !== null && filteredMentions.length > 0 && (
                            <View style={styles.mentionsContainer}>
                                <FlatList
                                    keyboardShouldPersistTaps="always"
                                    data={filteredMentions}
                                    keyExtractor={(item) => item.id}
                                    style={{ maxHeight: 150 }}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.mentionItemRow}
                                            onPress={() => handleSelectMention(item)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.mentionAvatarContainer}>
                                                {item.avatar ? (
                                                    <Image source={{ uri: item.avatar }} style={styles.mentionAvatar} />
                                                ) : (
                                                    <View style={styles.mentionAvatarPlaceholder}>
                                                        <Text style={styles.mentionAvatarText}>
                                                            {(item.username || item.name || '?').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.mentionNameText}>{item.username || item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                        <View style={styles.inputContainer}>
                            <View style={styles.textInputWrapper}>
                                {isRecording ? (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Animated.View style={{ opacity: micPan.x.interpolate({ inputRange: [-100, 0], outputRange: [1, 0] }) }}>
                                                <Trash size={20} color="red" variant="Bold" style={{ marginRight: 10 }} />
                                            </Animated.View>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginRight: 10 }} />
                                            <Text style={{ fontFamily: FONT_BODY, fontSize: 15, color: '#1C1C1E' }}>
                                                {formatDurationMs(recordTime)}
                                            </Text>
                                        </View>

                                        <Animated.View style={{ opacity: micPan.x.interpolate({ inputRange: [-100, 0], outputRange: [0, 1] }), flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#8E8E93', marginRight: 15 }}>
                                                {"< Slide to cancel"}
                                            </Text>
                                        </Animated.View>
                                    </View>
                                ) : (
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Type Message"
                                        placeholderTextColor="#8E8E93"
                                        value={message}
                                        onChangeText={handleMessageChange}
                                        onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                                        onSubmitEditing={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                    />
                                )}
                                {uploading ? (
                                    <ActivityIndicator size="small" color="#1366D9" style={{ padding: 8 }} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {!isRecording && (
                                            <TouchableOpacity style={styles.attachmentButton} activeOpacity={0.7} onPress={handlePickAttachment}>
                                                <AttachmentIcon width={24} height={24} />
                                            </TouchableOpacity>
                                        )}
                                        <Animated.View
                                            {...panResponder.panHandlers}
                                            style={[styles.attachmentButton, { transform: [{ translateX: micPan.x }] }, isRecording && { backgroundColor: '#1366D9', borderRadius: 20, padding: 4 }]}
                                        >
                                            {isRecording ? (
                                                <StopIcon width={24} height={24} color="#FFF" />
                                            ) : (
                                                <MicIcon width={24} height={24} color="#8E8E93" />
                                            )}
                                        </Animated.View>
                                    </View>
                                )}
                            </View>

                            {!isRecording && (message.trim().length > 0 || pendingAttachment) && (
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    activeOpacity={0.8}
                                    onPress={pendingAttachment ? handleSendPendingAttachment : handleSendMessage}
                                >
                                    <SendPaperplaneIcon width={24} height={24} />
                                </TouchableOpacity>
                            )}
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
        backgroundColor: '#F7F7F9',
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
    reportSheetTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
        fontWeight: '600',
        color: '#1C1C1E',
        textAlign: 'center',
        marginBottom: 12,
        marginTop: 20,
    },
    reportSheetInput: {
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: '#1C1C1E',
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 72,
        maxHeight: 100,
        marginBottom: 16,
        textAlignVertical: 'top',
    },
    reportSheetActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 4,
    },
    reportSheetButton: {
        flex: 1,
    },
    headerOptionsBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerOptionsBox: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        minWidth: 200,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    headerOptionItem: {
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    headerOptionSheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F2F2F7',
        marginBottom: 12,
    },
    headerOptionSheetItemDanger: {
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
    },
    headerOptionText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#1C1C1E',
    },
    headerOptionItemDanger: {},
    headerOptionTextDanger: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#FF3B30',
    },
    deletedMessageText: {
        fontStyle: 'italic',
        opacity: 0.8,
    },
    editMessageBox: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginHorizontal: 24,
        padding: 20,
        minWidth: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    editMessageTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
        color: '#1C1C1E',
        marginBottom: 12,
    },
    editMessageInput: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#1C1C1E',
        borderWidth: 1,
        borderColor: '#E5E5EA',
        borderRadius: 8,
        padding: 12,
        minHeight: 80,
        maxHeight: 120,
        marginBottom: 16,
    },
    editMessageActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    editMessageCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    editMessageCancelText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: '#8E8E93',
    },
    editMessageSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
    },
    editMessageSaveBtnDisabled: {
        opacity: 0.5,
    },
    editMessageSaveText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        color: COLORS.white,
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
        backgroundColor: COLORS.white,
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
        backgroundColor: COLORS.primary,
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
        color: '#1C1C1E',
    },
    messageTextSent: {
        color: COLORS.white,
    },
    seeMoreTouchable: {
        alignSelf: 'flex-end',
        marginTop: 10,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    seeMoreTouchableSent: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    seeMoreTouchableReceived: {
        backgroundColor: 'rgba(19, 102, 217, 0.12)',
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
    },
    fileAttachmentText: {
        fontSize: 14,
        textDecorationLine: 'underline',
        flexShrink: 1,
    },
    mentionsContainer: {
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    mentionItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    mentionAvatarContainer: {
        marginRight: 12,
    },
    mentionAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    mentionAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1366D9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mentionAvatarText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    mentionNameText: {
        fontSize: 15,
        color: '#1C1C1E',
        fontFamily: FONT_BODY,
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
        color: COLORS.primary,
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
