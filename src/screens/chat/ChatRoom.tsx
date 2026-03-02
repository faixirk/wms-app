import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, PermissionsAndroid,
    Modal, Linking, Dimensions, Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { ArrowWhiteLeftIcon, CalenderBlueIcon, ChatVideoCamIcon, SendPaperplaneIcon, MicIcon, AttachmentIcon, PlayButtonIcon, StopIcon, PauseIcon, CloseIcon, PhoneIcon } from '../../assets/svgs';
import { chatScreenBg } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchChatList, fetchChatMessages, ApiMessage, addMessageToRoom } from '../../redux/slices/chat';
import { socketService } from '../../services/network/socket';
import { uploadFile } from '../../services/network/upload';
import { useSound } from 'react-native-nitro-sound';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useCall } from '../../context/CallContext';

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

    const { startRecorder, stopRecorder } = useSound({
        onRecord: (e) => setRecordTime(e.currentPosition)
    });

    // Store mapping
    const { user, selectedWorkspaceId } = useAppSelector(state => state.auth);
    const { activeRoomMessages, loadingMessages, chats, onlineStatuses } = useAppSelector(state => state.chat);

    const messages = activeRoomMessages[chatId] || [];
    const isLoading = loadingMessages[chatId] || false;
    const flatListRef = useRef<FlatList>(null);
    const userId = user?.id || (user?.data as any)?.id; // Resolving specific backend response nesting

    // Resolve Chat Details (for header avatar/name)
    const currentChat = chats.find(c => c.id === chatId);
    const otherParticipant = currentChat?.participants?.find((p: any) => p.id !== userId) || currentChat?.participants?.[0];
    const headerNameFull = otherParticipant?.username || otherParticipant?.name || currentChat?.title || currentChat?.name || 'Chat';
    const headerName = (headerNameFull || '').trim().split(/\s+/)[0] || headerNameFull;
    const headerAvatarUri = currentChat?.avatar || otherParticipant?.avatar;
    const showHeaderAvatarImage = !!headerAvatarUri;
    const headerAvatarInitial = (headerName || '?').trim().charAt(0).toUpperCase() || '?';
    const otherUserId = otherParticipant?.id;
    const isOnline = otherUserId && onlineStatuses[otherUserId]?.status === 'online';

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
            }
        };
        socketService.on('chat:message:new', handleNewMessage);

        return () => {
            socketService.emit('chat:leave', { chatId });
            socketService.off('chat:message:new', handleNewMessage);
        };
    }, [chatId, selectedWorkspaceId, dispatch]);

    const handleSendMessage = () => {
        if (!message.trim() && !uploading) return;

        socketService.emit('chat:message:send', {
            chatId,
            content: message.trim(),
            clientMessageId: Date.now().toString(), // basic deduplication tracking ID
        });

        // Optimistically add to list internally? Backend should emit `chat:message:ack` and `chat:message:new`
        // We'll rely on the server roundtrip for simplicity as per standard specs unless UI demands immediate

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
                socketService.emit('chat:message:send', {
                    chatId,
                    attachments: [{
                        url: uploadRes.publicUrl,
                        key: uploadRes.filename,
                        name: fileName,
                        mimeType,
                        size: fileSize,
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

        return (
            <View style={[styles.messageRow, isSent ? styles.messageRowRight : styles.messageRowLeft]}>
                {!isSent && (
                    <Image source={{ uri: otherParticipant?.avatar || 'https://i.pravatar.cc/150' }} style={styles.avatarSmall} />
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

                    <Text style={{
                        fontSize: 10,
                        color: isSent ? '#5A5A5A' : 'rgba(255,255,255,0.7)',
                        alignSelf: 'flex-end',
                        marginTop: 4
                    }}>
                        {msgTime}
                    </Text>
                </View>
            </View>
        );
    };

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    return (
        <SafeAreaView style={styles.safeArea}>
            <ImageBackground source={chatScreenBg} style={styles.background} resizeMode="cover">

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

                {/* Custom Header */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <ArrowWhiteLeftIcon width={24} height={24} />
                    </TouchableOpacity>

                    <View style={styles.userInfoContainer}>
                        {showHeaderAvatarImage ? (
                            <Image source={{ uri: headerAvatarUri }} style={styles.headerAvatar} />
                        ) : (
                            <View style={styles.headerAvatarPlaceholder}>
                                <Text style={styles.headerAvatarPlaceholderText}>{headerAvatarInitial}</Text>
                            </View>
                        )}
                        <View style={styles.userInfoText}>
                            <Text style={styles.userName}>{headerName}</Text>
                            <Text style={styles.userStatus}>{isOnline ? 'Online' : 'Offline'}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActionsPill}>
                        <TouchableOpacity style={styles.actionIconPill} activeOpacity={0.7}>
                            <CalenderBlueIcon width={24} height={24} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionIconPill}
                            activeOpacity={0.7}
                            onPress={() => {
                                if (otherUserId && selectedWorkspaceId && chatId) {
                                    startCall({
                                        workspaceId: selectedWorkspaceId,
                                        chatId,
                                        peerUserId: otherUserId,
                                        peerUsername: headerNameFull,
                                        kind: 'audio'
                                    });
                                }
                            }}
                        >
                            <PhoneIcon width={24} height={24} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionIconPill} activeOpacity={0.7}>
                            <ChatVideoCamIcon width={24} height={24} />
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
                                    onChangeText={setMessage}
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
            </ImageBackground>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0A58CA',
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
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
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
        color: COLORS.white,
    },
    userStatus: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
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
    messageBubble: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        maxWidth: '75%',
    },
    messageBubbleReceived: {
        backgroundColor: '#4A81CD',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        borderBottomLeftRadius: 0,
    },
    messageBubbleSent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 2,
    },
    messageText: {
        fontFamily: FONT_BODY,
        fontSize: 14,
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
});

export default ChatRoom;
