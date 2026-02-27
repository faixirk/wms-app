import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomHeader } from '../../components';
import { SearchIcon, PlusIcon, ArrowLeftIcon } from '../../assets/svgs';
import { emptyChatImg } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchChatList, ApiChat, updateBulkPresence, updatePresence } from '../../redux/slices/chat';
import { socketService } from '../../services/network/socket';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';

const ChatList = ({ navigation }: any) => {
    const dispatch = useAppDispatch();
    const { chats, loadingChats, onlineStatuses } = useAppSelector((state) => state.chat);
    const { selectedWorkspaceId, user } = useAppSelector((state) => state.auth);

    const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!selectedWorkspaceId) return;

        // Fetch initial state natively
        dispatch(fetchChatList(selectedWorkspaceId as string));

        // Setup socket connection for this specific workspace
        const token = user?.token || (user?.data && typeof user.data === 'object' && user.data.token);
        if (token) {
            socketService.connect(token, selectedWorkspaceId as string);
        }

        // Listeners for list refresh
        socketService.on('chat:list:update', () => {
            dispatch(fetchChatList(selectedWorkspaceId as string)); // Simple approach: refetch list when signaled
        });

        socketService.on('presence:bulk', (data: Record<string, any>) => {
            dispatch(updateBulkPresence(data));
        });

        socketService.on('presence:update', (data: any) => {
            dispatch(updatePresence(data));
        });

        // Broadcast alive status loosely upon render
        socketService.emit('presence:activity');

        // Cleanup
        return () => {
            socketService.off('chat:list:update');
            socketService.off('presence:bulk');
            socketService.off('presence:update');
        };
    }, [selectedWorkspaceId, dispatch, user?.token]);

    const openMembersModal = async () => {
        setIsMembersModalVisible(true);
        setLoadingMembers(true);
        try {
            const res = await request<any>({
                url: ENDPOINTS.WORKSPACE_MEMBERS(selectedWorkspaceId as string),
                method: 'GET'
            });
            const data = res?.data;
            let fetchedMembers: any[] = [];
            if (Array.isArray(data)) {
                fetchedMembers = data;
            } else if (data?.data && Array.isArray(data.data)) {
                fetchedMembers = data.data;
            } else if (data?.items && Array.isArray(data.items)) {
                fetchedMembers = data.items;
            }
            setMembers(fetchedMembers);
        } catch (error) {
            console.error('Failed to fetch members', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const initiateChatWithMember = async (member: any) => {
        setIsMembersModalVisible(false);
        try {
            const payload = {
                workspaceId: selectedWorkspaceId,
                type: 'DIRECT',
                otherUserId: member.userId || member.user?.id || member.id,
            };
            const res = await request<any>({
                url: ENDPOINTS.CHAT_CREATE,
                method: 'POST',
                data: payload
            });
            const chatData = res?.data;
            if (chatData?.id) {
                navigation.navigate('ChatRoom', { chatId: chatData.id });
                // Optimistically fetch list to ensure promptness
                dispatch(fetchChatList(selectedWorkspaceId as string));
            }
        } catch (error) {
            console.error('Failed to create chat', error);
        }
    };

    const renderChatItem = ({ item }: { item: ApiChat }) => {
        // Extract the user details to filter out currentUser safely
        const u = user as any;
        const currentUserId = u?.id || u?.user?.id || u?.data?.user?.id || u?.data?.id;

        // Find other participant for direct chat name/avatar fallback
        const otherParticipant = item.participants?.find((p: any) => p.id !== currentUserId) || item.participants?.[0];

        const chatName = item.title || item.name || otherParticipant?.username || otherParticipant?.name || 'Unknown Chat';
        const chatAvatar = item.avatar || otherParticipant?.avatar || 'https://i.pravatar.cc/150';

        let messagePreview: string = 'No messages yet';
        let timePreview = '';
        if (item.lastMessage) {
            messagePreview = (item.lastMessage.content ? String(item.lastMessage.content) : null) || (item.lastMessage.attachments?.length ? 'Attachment' : messagePreview);

            // Format time if valid
            try {
                if (item.lastMessage.createdAt) {
                    const date = new Date(item.lastMessage.createdAt);
                    timePreview = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {
                // ignore
            }
        }

        const hasAttachment = item.lastMessage?.attachments && item.lastMessage.attachments.length > 0;

        return (
            <TouchableOpacity
                style={styles.chatItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
            >
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: chatAvatar }} style={styles.avatar} />
                    {hasAttachment && (
                        <View style={styles.attachmentBadge}>
                            <Text style={styles.attachmentText}>📎</Text>
                        </View>
                    )}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.headerRow}>
                        <Text style={styles.nameText}>{chatName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {!!item.unreadCount && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                                </View>
                            )}
                            <Text style={styles.timeText}>{timePreview}</Text>
                        </View>
                    </View>
                    <Text style={styles.messageText} numberOfLines={1}>
                        {messagePreview || 'No messages yet'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderMemberItem = ({ item }: { item: any }) => {
        const memberUser = item.user || {};
        const memberName = memberUser.username || memberUser.name || item.name || `${item.firstName} ${item.lastName}` || 'Unknown User';
        const memberAvatar = memberUser.avatar || item.avatar || 'https://i.pravatar.cc/150';

        return (
            <TouchableOpacity
                style={styles.memberItem}
                onPress={() => initiateChatWithMember(item)}
                activeOpacity={0.7}
            >
                <Image source={{ uri: memberAvatar }} style={styles.memberAvatar} />
                <Text style={styles.memberName}>{memberName}</Text>
            </TouchableOpacity>
        );
    };

    const filteredChats = chats.filter(chat => {
        const u = user as any;
        const currentUserId = u?.id || u?.user?.id || u?.data?.user?.id || u?.data?.id;
        const otherParticipant = chat.participants?.find((p: any) => p.id !== currentUserId) || chat.participants?.[0];
        const chatName = chat.title || chat.name || otherParticipant?.username || otherParticipant?.name || 'Unknown Chat';
        return chatName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomHeader
                titleSuffix="CHATS"
                onBackPress={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity
                        style={styles.plusButton}
                        activeOpacity={0.8}
                        onPress={openMembersModal}
                    >
                        <PlusIcon width={24} height={24} color="#6938EF" />
                    </TouchableOpacity>
                }
            />

            <View style={styles.content}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <SearchIcon width={24} height={24} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Messages"
                        placeholderTextColor="#8E8E93"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Chat List Container */}
                <View style={[styles.listContainer, (loadingChats || chats.length === 0) && { backgroundColor: 'transparent', elevation: 0, shadowColor: 'transparent' }]}>
                    {loadingChats && chats.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredChats}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={renderChatItem}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            contentContainerStyle={[styles.flatListContent, chats.length === 0 && { padding: 0 }]}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyStateContainer}>
                                    <Image source={emptyChatImg} style={styles.emptyStateImage} resizeMode="contain" />
                                    <Text style={styles.emptyStateText}>YOU DONT HAVE ANY CHATS TO PREVIEW</Text>
                                </View>
                            )}
                        />
                    )}
                </View>
            </View>

            {/* Members Selection Modal */}
            <Modal
                visible={isMembersModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsMembersModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity style={styles.modalBackButton} onPress={() => setIsMembersModalVisible(false)}>
                            <ArrowLeftIcon width={24} height={24} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>New Chat</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    {loadingMembers ? (
                        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
                    ) : (
                        <FlatList
                            data={members}
                            keyExtractor={(item) => item.id}
                            renderItem={renderMemberItem}
                            contentContainerStyle={styles.membersList}
                            ListEmptyComponent={() => (
                                <Text style={{ textAlign: 'center', marginTop: 40, color: '#8E8E93' }}>No members found in this workspace.</Text>
                            )}
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background, // F5F5F5
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 18,
        paddingHorizontal: 20,
        height: 50,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.01,
        shadowRadius: 8,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '600',
        color: '#5A5A5A',
        marginLeft: 12,
        height: '100%',
    },
    listContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 5,
    },
    flatListContent: {
        paddingTop: 24,
        paddingBottom: 24,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    attachmentBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#E6E6FA',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    attachmentText: {
        fontSize: 10,
        color: '#6938EF',
    },
    chatContent: {
        flex: 1,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.black,
    },
    timeText: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: '400',
        color: '#6938EF', // Purple matching the design
    },
    messageText: {
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: '400',
        color: '#6938EF', // Purple matching the design
    },
    separator: {
        height: 32, // Spacing between items
    },
    unreadBadge: {
        backgroundColor: '#6938EF',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginRight: 6,
    },
    unreadText: {
        color: COLORS.white,
        fontSize: 10,
        fontFamily: FONT_BODY,
        fontWeight: '700',
    },
    plusButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    emptyStateImage: {
        width: 300,
        height: 250,
        marginBottom: 24,
    },
    emptyStateText: {
        fontFamily: FONT_HEADING,
        fontSize: 14,
        color: '#5A5A5A',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
    },
    modalBackButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
    },
    membersList: {
        paddingTop: 16,
        paddingBottom: 40,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 16,
    },
    memberName: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.black,
    },
});

export default ChatList;
