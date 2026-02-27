import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, PermissionsAndroid
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { ArrowWhiteLeftIcon, CalenderBlueIcon, ChatVideoCamIcon, SendPaperplaneIcon, MicIcon, AttachmentIcon, PlayButtonIcon } from '../../assets/svgs';
import { chatScreenBg } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchChatList, fetchChatMessages, ApiMessage, addMessageToRoom } from '../../redux/slices/chat';
import { socketService } from '../../services/network/socket';
import { uploadFile } from '../../services/network/upload';
import { useSound } from 'react-native-nitro-sound';
// @ts-ignore
import Icon from 'react-native-vector-icons/Ionicons';

const AudioMessagePlayer = ({ url, isSent, duration: initialDuration = 0 }: { url: string; isSent: boolean; duration?: number }) => {
    const { startPlayer, pausePlayer, resumePlayer, state } = useSound({
        subscriptionDuration: 0.1, // 100ms updates for smooth waveform
    });

    const playPause = async () => {
        try {
            if (state.isPlaying) {
                await pausePlayer();
            } else {
                if (state.currentPosition === 0 || state.currentPosition >= state.duration) {
                    await startPlayer(url);
                } else {
                    await resumePlayer();
                }
            }
        } catch (e) {
            console.log('Playback failed', e);
        }
    };

    const formatTime = (ms: number) => {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${mins}:${s < 10 ? '0' : ''}${s}`;
    };

    const trackColor = isSent ? '#EAEAEA' : '#FFFFFF';
    const playedColor = isSent ? '#1366D9' : '#2E8B57';

    const activeDuration = state.duration > 0 ? state.duration : (initialDuration * 1000);
    const progress = activeDuration > 0 ? (state.currentPosition / activeDuration) * 15 : 0;
    const timeToDisplay = state.currentPosition > 0 ? state.currentPosition : activeDuration;

    return (
        <View style={styles.audioBubbleContainer}>
            <View style={styles.waveformContainer}>
                {[...Array(15)].map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.waveformBar,
                            {
                                height: Math.max(8, Math.random() * 24),
                                backgroundColor: i <= progress ? playedColor : trackColor,
                                opacity: i <= progress ? 1 : 0.5
                            }
                        ]}
                    />
                ))}
            </View>
            <TouchableOpacity onPress={playPause} activeOpacity={0.8} style={{
                justifyContent: 'center', alignItems: 'center', width: 28, height: 28, borderRadius: 14,
                backgroundColor: isSent ? '#EAEAEA' : 'rgba(255,255,255,0.2)'
            }}>
                {state.isPlaying ? (
                    <Icon name="pause" size={16} color={isSent ? '#1366D9' : '#FFF'} />
                ) : (
                    <PlayButtonIcon width={28} height={28} />
                )}
            </TouchableOpacity>
            <Text style={{ fontSize: 10, color: isSent ? '#1366D9' : '#FFF', minWidth: 32, textAlign: 'right' }}>
                {formatTime(timeToDisplay)}
            </Text>
        </View>
    );
};

const ChatRoom = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const dispatch = useAppDispatch();

    // Fallback ID if not provided, though it typically should be
    const chatId = route.params?.chatId;

    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);

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
    const headerName = currentChat?.name || otherParticipant?.name || 'Chat';
    const headerAvatar = currentChat?.avatar || otherParticipant?.avatar || 'https://i.pravatar.cc/150';
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

            const uploadRes = await uploadFile(uri, fileName, mimeType);

            if (uploadRes.success && uploadRes.publicUrl) {
                socketService.emit('chat:message:send', {
                    chatId,
                    attachments: [{
                        url: uploadRes.publicUrl,
                        key: uploadRes.filename,
                        name: 'Voice Message',
                        mimeType,
                        size: 0
                    }]
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

            setUploading(true);

            // Execute the highly scalable 2-step S3 flow documented
            const uploadRes = await uploadFile(result.uri, result.name || 'attachment.file', result.type || 'application/octet-stream');

            if (uploadRes.success && uploadRes.publicUrl) {
                // Instantly dispatch out standard socket payload containing attachment
                socketService.emit('chat:message:send', {
                    chatId,
                    attachments: [{
                        url: uploadRes.publicUrl,
                        key: uploadRes.filename,
                        name: result.name,
                        mimeType: result.type,
                        size: result.size
                    }]
                });
            } else {
                Alert.alert('Upload Failed', 'There was an issue uploading your file. Please try again.');
            }
        } catch (err: any) {
            if (!DocumentPicker.isCancel(err)) {
                console.error('attachment picker error', err);
                Alert.alert('Error', 'Failed to pick attachment');
            }
        } finally {
            setUploading(false);
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
                            <Image source={{ uri: mainAttachment.url }} style={{ width: 150, height: 150, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                        ) : mainAttachment.mimeType?.includes('audio') ? (
                            <AudioMessagePlayer url={mainAttachment.url} isSent={isSent} />
                        ) : (
                            <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived, { fontStyle: 'italic', textDecorationLine: 'underline' }]}>
                                {mainAttachment.name || 'Attached File'}
                            </Text>
                        )
                    ) : null}

                    {!!item.content && (
                        <Text style={[
                            styles.messageText,
                            isSent ? styles.messageTextSent : styles.messageTextReceived
                        ]}>
                            {item.content}
                        </Text>
                    )}

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

    return (
        <SafeAreaView style={styles.safeArea}>
            <ImageBackground source={chatScreenBg} style={styles.background} resizeMode="cover">

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
                        <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
                        <View style={styles.userInfoText}>
                            <Text style={styles.userName}>{headerName}</Text>
                            <Text style={styles.userStatus}>{isOnline ? 'Online' : 'Offline'}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActionsPill}>
                        <TouchableOpacity style={styles.actionIconPill} activeOpacity={0.7}>
                            <CalenderBlueIcon width={24} height={24} />
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
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
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
                                    onSubmitEditing={handleSendMessage}
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
                            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={handleSendMessage}>
                                <SendPaperplaneIcon width={24} height={24} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.iconButton, isRecording && { backgroundColor: '#1366D9' }]}
                            activeOpacity={0.8}
                            onPress={isRecording ? handleStopRecording : handleStartRecording}
                        >
                            {isRecording ? (
                                <Icon name="stop" size={24} color="#FFF" />
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
