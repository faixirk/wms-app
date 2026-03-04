import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal, Alert, Keyboard, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchIcon, SearchWhiteIcon, PlusWhiteIcon, ArrowLeftIcon } from '../../assets/svgs';
import { emptyChatImg, newChatLogo, newGroupLogo } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { useFocusEffect } from '@react-navigation/native';
import { fetchChatList, ApiChat, updateBulkPresence, updatePresence } from '../../redux/slices/chat';
import { setGreeting } from '../../redux/slices/auth';
import { socketService } from '../../services/network/socket';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';
import ModalSheet from '../../components/ModalSheet';

/** Format message date for chat list: time today, "Yesterday", "X days ago", "X week(s) ago", or date. */
function formatChatListDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffDays === 1) {
        return 'Yesterday';
    }
    if (diffDays >= 2 && diffDays <= 6) {
        return `${diffDays} days ago`;
    }
    if (diffDays >= 7 && diffDays <= 13) {
        return '1 week ago';
    }
    if (diffDays >= 14 && diffDays <= 20) {
        return '2 weeks ago';
    }
    if (diffDays >= 21 && diffDays <= 27) {
        return '3 weeks ago';
    }
    if (diffDays >= 28 && diffDays <= 34) {
        return '4 weeks ago';
    }
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const ChatList = ({ navigation }: any) => {
    const dispatch = useAppDispatch();
    const { chats, loadingChats, onlineStatuses } = useAppSelector((state) => state.chat);
    const { selectedWorkspaceId, user, greeting } = useAppSelector((state) => state.auth);
    const u = user as Record<string, unknown> | undefined;
    const userData = u?.data as Record<string, unknown> | undefined;
    const displayName = (userData?.username ?? userData?.name ?? u?.username ?? u?.name) as string | undefined;
    const userAvatarUri = (userData?.avatar ?? u?.avatar ?? (u?.user as Record<string, unknown> | undefined)?.avatar) as string | undefined;

    const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
    const [isCreateOptionsModalVisible, setIsCreateOptionsModalVisible] = useState(false);
    const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);

    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchVisible, setSearchVisible] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // Track active typing per chat room globally
    const [typingChats, setTypingChats] = useState<Record<string, ReturnType<typeof setTimeout>>>({});

    // State for creating group
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Refresh greeting when screen is focused (e.g. time of day)
    useEffect(() => {
        dispatch(setGreeting());
    }, [dispatch]);

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

        const handleGlobalTyping = (data: { chatId: string, userId: string, isTyping: boolean }) => {
            const currentUserId = user?.id || (user?.data as any)?.id;
            if (data.userId === currentUserId) return; // ignore our own

            setTypingChats(prev => {
                const newPrev = { ...prev };
                if (data.isTyping) {
                    if (newPrev[data.chatId]) clearTimeout(newPrev[data.chatId]);
                    newPrev[data.chatId] = setTimeout(() => {
                        setTypingChats(current => {
                            const updated = { ...current };
                            delete updated[data.chatId];
                            return updated;
                        });
                    }, 3000);
                } else {
                    if (newPrev[data.chatId]) {
                        clearTimeout(newPrev[data.chatId]);
                        delete newPrev[data.chatId];
                    }
                }
                return newPrev;
            });
        };
        socketService.on('chat:typing', handleGlobalTyping);

        // Broadcast alive status loosely upon render
        socketService.emit('presence:activity');

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            socketService.off('chat:list:update');
            socketService.off('presence:bulk');
            socketService.off('presence:update');
            socketService.off('chat:typing', handleGlobalTyping);
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, [selectedWorkspaceId, dispatch, user?.token]);

    // Ensure we are joined to all chat rooms to receive 'chat:typing' events on the chat list page
    useFocusEffect(
        useCallback(() => {
            if (!selectedWorkspaceId || !chats || chats.length === 0) return;
            chats.forEach(chat => {
                socketService.emit('chat:join', {
                    chatId: chat.id,
                    workspaceId: selectedWorkspaceId
                });
            });
        }, [chats, selectedWorkspaceId])
    );

    const fetchWorkspaceMembers = async () => {
        if (members.length > 0) return; // Prevent re-fetching if already loaded
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
        } catch (err: unknown) {
            const msg =
                err != null && typeof err === 'object' && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Failed to fetch members';
            console.error('Failed to fetch members', msg);
        } finally {
            setLoadingMembers(false);
        }
    };

    const openMembersModal = async () => {
        setIsMembersModalVisible(true);
        await fetchWorkspaceMembers();
    };

    const initiateChatWithMember = async (member: any) => {
        const otherUserId = member.userId || member.user?.id || member.id;
        if (!otherUserId) return;
        setIsMembersModalVisible(false);
        try {
            const payload = {
                workspaceId: selectedWorkspaceId,
                type: 'DIRECT',
                otherUserId,
            };
            const res = await request<any>({
                url: ENDPOINTS.CHAT_CREATE,
                method: 'POST',
                data: payload
            });
            // Support multiple response shapes: res.data.id, res.data.data.id, res.data.chat.id
            const chatData = res?.data;
            const chatId =
                chatData?.id ||
                chatData?.data?.id ||
                chatData?.chat?.id;
            if (chatId) {
                dispatch(fetchChatList(selectedWorkspaceId as string));
                navigation.navigate('ChatRoom', { chatId });
            }
        } catch (error) {
            console.error('Failed to create chat', error);
        }
    };

    const createGroupChat = async () => {
        if (!groupName.trim()) {
            Alert.alert('Error', 'Please enter a group name.');
            return;
        }
        if (selectedMemberIds.length === 0) {
            Alert.alert('Error', 'Please select at least one member.');
            return;
        }

        setCreatingGroup(true);
        try {
            const payload = {
                workspaceId: selectedWorkspaceId,
                type: 'GROUP',
                name: groupName.trim(),
                participantUserIds: selectedMemberIds,
            };
            const res = await request<any>({
                url: ENDPOINTS.CHAT_CREATE,
                method: 'POST',
                data: payload
            });

            const chatData = res?.data;
            const chatId = chatData?.id || chatData?.data?.id || chatData?.chat?.id;

            if (chatId) {
                // Reset states
                setIsCreateGroupModalVisible(false);
                setGroupName('');
                setSelectedMemberIds([]);
                setMemberSearchQuery('');

                dispatch(fetchChatList(selectedWorkspaceId as string));
                navigation.navigate('ChatRoom', { chatId });
            }
        } catch (error: any) {
            console.error('Failed to create group chat', error);
            Alert.alert('Error', error?.message || 'Failed to create group');
        } finally {
            setCreatingGroup(false);
        }
    };

    const toggleMemberSelection = (memberId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const renderChatItem = ({ item }: { item: ApiChat }) => {
        // Extract the user details to filter out currentUser safely
        const u = user as any;
        const currentUserId = u?.id || u?.user?.id || u?.data?.user?.id || u?.data?.id;

        // Find other participant for direct chat name/avatar fallback
        const otherParticipant = item.participants?.find((p: any) => p.id !== currentUserId) || item.participants?.[0];

        const isGroup = item.type === 'GROUP';

        // Set name and avatar depending on chat type
        const chatName = isGroup
            ? (item.name || item.title || 'Group Chat')
            : (item.title || item.name || otherParticipant?.username || otherParticipant?.name || 'Unknown Chat');

        const chatAvatarUri = isGroup
            ? item.avatar
            : (item.avatar || otherParticipant?.avatar);

        const showAvatarImage = !!chatAvatarUri;
        const avatarInitial = (chatName || '?').trim().charAt(0).toUpperCase() || '?';

        let messagePreview: string = 'No messages yet';
        let datePreview = '';
        if (item.lastMessage) {
            messagePreview = (item.lastMessage.content ? String(item.lastMessage.content) : null) || (item.lastMessage.attachments?.length ? 'Attachment' : messagePreview);
            try {
                if (item.lastMessage.createdAt) {
                    const date = new Date(item.lastMessage.createdAt);
                    datePreview = formatChatListDate(date);
                }
            } catch (e) {
                // ignore
            }
        }

        const hasAttachment = item.lastMessage?.attachments && item.lastMessage.attachments.length > 0;

        // Extract online status (only relevant for Direct Chats)
        const otherUserId = otherParticipant?.id;
        const isOnline = otherUserId ? onlineStatuses[otherUserId]?.status === 'online' : false;
        const statusColor = isOnline ? '#4ADE80' : '#FDB52A';

        return (
            <TouchableOpacity
                style={styles.chatCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
            >
                <View style={styles.avatarContainer}>
                    {showAvatarImage ? (
                        <Image source={{ uri: chatAvatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarPlaceholderText}>{avatarInitial}</Text>
                        </View>
                    )}

                    {!isGroup && (
                        <View style={[styles.chatStatusDot, { backgroundColor: statusColor }]} />
                    )}

                    {hasAttachment && (
                        <View style={styles.attachmentBadge}>
                            <Text style={styles.attachmentText}>📎</Text>
                        </View>
                    )}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.headerRow}>
                        <Text style={styles.nameText} numberOfLines={1}>{chatName}</Text>
                        <View style={styles.chatMetaRow}>
                            {!!item.unreadCount && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.messageRow}>
                        {typingChats[item.id] ? (
                            <Text style={[styles.messageText, { color: '#4ADE80', fontStyle: 'italic' }]} numberOfLines={1} ellipsizeMode="tail">
                                typing...
                            </Text>
                        ) : (
                            <Text style={styles.messageText} numberOfLines={1} ellipsizeMode="tail">
                                {messagePreview || 'No messages yet'}
                            </Text>
                        )}
                        {datePreview && !typingChats[item.id] ? <Text style={styles.dateText}>{datePreview}</Text> : null}
                    </View>

                </View>
            </TouchableOpacity>
        );
    };

    const renderMemberItem = ({ item }: { item: any }) => {
        const memberUser = item.user || {};
        const memberName = memberUser.username || memberUser.name || item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown User';
        const memberAvatarUri = memberUser.avatar || item.avatar;
        const showMemberAvatar = !!memberAvatarUri;
        const memberInitial = (memberName || '?').trim().charAt(0).toUpperCase() || '?';

        // Extract online status
        const otherUserId = item.userId || item.user?.id || item.id;
        const isOnline = onlineStatuses[otherUserId]?.status === 'online';
        const statusColor = isOnline ? '#4ADE80' : '#FDB52A'; // From UI reference

        return (
            <TouchableOpacity
                style={styles.memberItem}
                onPress={() => initiateChatWithMember(item)}
                activeOpacity={0.7}
            >
                <View style={styles.memberAvatarWrapper}>
                    {showMemberAvatar ? (
                        <Image source={{ uri: memberAvatarUri }} style={styles.memberAvatar} />
                    ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberAvatarPlaceholderText}>{memberInitial}</Text>
                        </View>
                    )}
                    <View style={[styles.memberStatusDot, { backgroundColor: statusColor }]} />
                </View>
                <Text style={styles.memberName}>{memberName}</Text>
            </TouchableOpacity>
        );
    };

    const renderMemberSelectionItem = ({ item }: { item: any }) => {
        const memberUser = item.user || {};
        const memberName = memberUser.username || memberUser.name || item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown User';
        const memberAvatarUri = memberUser.avatar || item.avatar;
        const showMemberAvatar = !!memberAvatarUri;
        const memberInitial = (memberName || '?').trim().charAt(0).toUpperCase() || '?';
        const memberId = item.userId || item.user?.id || item.id;

        const isOnline = onlineStatuses[memberId]?.status === 'online';
        const statusColor = isOnline ? '#4ADE80' : '#FDB52A';
        const isSelected = selectedMemberIds.includes(memberId);

        return (
            <TouchableOpacity
                style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                onPress={() => toggleMemberSelection(memberId)}
                activeOpacity={0.7}
            >
                <View style={styles.memberAvatarWrapper}>
                    {showMemberAvatar ? (
                        <Image source={{ uri: memberAvatarUri }} style={styles.memberAvatar} />
                    ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberAvatarPlaceholderText}>{memberInitial}</Text>
                        </View>
                    )}
                    <View style={[styles.memberStatusDot, { backgroundColor: statusColor }]} />
                </View>
                <Text style={styles.memberName}>{memberName}</Text>

                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const filteredMembers = members.filter((member) => {
        const memberUser = member.user || {};
        const memberName = memberUser.username || memberUser.name || member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown User';
        return memberName.toLowerCase().includes(memberSearchQuery.toLowerCase());
    });

    const filteredChats = chats.filter(chat => {
        const u = user as any;
        const currentUserId = u?.id || u?.user?.id || u?.data?.user?.id || u?.data?.id;
        const otherParticipant = chat.participants?.find((p: any) => p.id !== currentUserId) || chat.participants?.[0];
        const chatName = chat.title || chat.name || otherParticipant?.username || otherParticipant?.name || 'Unknown Chat';
        return chatName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const currentUserObj = user as any;
    const currentUserIdForHeader = currentUserObj?.id || currentUserObj?.user?.id || currentUserObj?.data?.user?.id || currentUserObj?.data?.id;
    const isCurrentUserOnline = currentUserIdForHeader ? onlineStatuses[currentUserIdForHeader]?.status === 'online' : true; // default to true for the active user
    const currentUserStatusColor = isCurrentUserOnline ? '#4ADE80' : '#FDB52A';

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header: avatar + greeting/name (from Redux), search + plus buttons */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerAvatarWrapper}>
                        {userAvatarUri ? (
                            <Image source={{ uri: userAvatarUri }} style={styles.headerAvatar} />
                        ) : (
                            <View style={styles.headerAvatarPlaceholder}>
                                <Text style={styles.headerAvatarInitial}>
                                    {(displayName ? String(displayName).trim().charAt(0) : 'U').toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.headerStatusDot, { backgroundColor: currentUserStatusColor }]} />
                    </View>
                    <View style={styles.headerTextWrapper}>
                        <Text style={styles.greetingText}>{greeting || 'Hello'}</Text>
                        <Text style={styles.displayNameText}>{(displayName ? String(displayName) : 'User').toUpperCase()}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.headerIconButton}
                        activeOpacity={0.8}
                        onPress={() => setSearchVisible((v) => !v)}
                    >
                        <SearchWhiteIcon width={20} height={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerIconButton, styles.headerIconButtonSecond]}
                        activeOpacity={0.8}
                        onPress={() => setIsCreateOptionsModalVisible(true)}
                    >
                        <PlusWhiteIcon width={18} height={18} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* CHATS title */}
            <Text style={styles.chatsTitle}>CHATS</Text>

            <View style={styles.content}>
                {searchVisible && (
                    <View style={styles.searchContainer}>
                        <SearchIcon width={20} height={20} color={COLORS.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search Messages"
                            placeholderTextColor={COLORS.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                )}

                {/* Chat List: card style */}
                <View style={[styles.listWrapper, (loadingChats || chats.length === 0) && styles.listWrapperEmpty]}>
                    {loadingChats && chats.length === 0 ? (
                        <View style={styles.loadingWrapper}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredChats}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={renderChatItem}
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
            <ModalSheet
                visible={isMembersModalVisible}
                customSheetInner={{
                    paddingHorizontal: 0,
                    paddingBottom: 0,
                }}
                onClose={() => setIsMembersModalVisible(false)}
                heightFraction={0.75}
                header={
                    <View style={styles.modalHeaderIconWrap}>
                        <Image source={newChatLogo} style={styles.modalHeaderImage} resizeMode="contain" />
                    </View>
                }
            >
                <View
                    style={{ flex: 1, marginTop: keyboardHeight > 0 ? (Platform.OS === 'ios' ? 75 : 50) : 0 }}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalSearchBar}>
                            <SearchIcon width={20} height={20} color={COLORS.textSecondary} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search Messages"
                                placeholderTextColor={COLORS.textSecondary}
                                value={memberSearchQuery}
                                onChangeText={setMemberSearchQuery}
                            />
                        </View>

                        <Text style={styles.modalNewChatTitle}>NEW CHAT</Text>

                        {loadingMembers ? (
                            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
                        ) : (
                            <FlatList
                                data={filteredMembers}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMemberItem}
                                contentContainerStyle={styles.membersList}
                                ListEmptyComponent={() => (
                                    <Text style={styles.membersEmptyText}>No members found.</Text>
                                )}
                            />
                        )}
                    </View>
                </View>
            </ModalSheet>

            {/* Options Selection Modal */}
            <ModalSheet
                visible={isCreateOptionsModalVisible}
                onClose={() => setIsCreateOptionsModalVisible(false)}
                heightFraction={0.3}
            >
                <View style={styles.optionsContent}>
                    <Text style={styles.modalNewChatTitle}>NEW CHAT</Text>

                    <TouchableOpacity
                        style={styles.optionButton}
                        onPress={() => {
                            setIsCreateOptionsModalVisible(false);
                            openMembersModal();
                        }}
                    >
                        <Text style={styles.optionButtonText}>Create DM Chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.optionButton}
                        onPress={async () => {
                            setIsCreateOptionsModalVisible(false);
                            setMemberSearchQuery('');
                            setSelectedMemberIds([]);
                            setGroupName('');
                            await fetchWorkspaceMembers();
                            setIsCreateGroupModalVisible(true);
                        }}
                    >
                        <Text style={styles.optionButtonText}>Create New Group</Text>
                    </TouchableOpacity>
                </View>
            </ModalSheet>

            {/* Group Creating Modal */}
            <ModalSheet
                visible={isCreateGroupModalVisible}
                customSheetInner={{
                    paddingHorizontal: 0,
                    paddingBottom: 0,
                }}
                onClose={() => setIsCreateGroupModalVisible(false)}
                heightFraction={0.8}
                header={
                    <View style={styles.modalHeaderIconWrap}>
                        <Image source={newGroupLogo} style={styles.modalHeaderImage} resizeMode="contain" />
                    </View>
                }
            >
                <View
                    style={{ flex: 1, marginTop: keyboardHeight > 0 ? (Platform.OS === 'ios' ? 85 : 50) : 0 }}
                >
                    <View style={styles.modalContent}>
                        <Text style={[styles.modalNewChatTitle, { marginTop: 60 }]}>CREATE GROUP</Text>

                        <View style={styles.groupInputContainer}>
                            <TextInput
                                style={styles.groupNameInput}
                                placeholder="Group Name"
                                placeholderTextColor={COLORS.textSecondary}
                                value={groupName}
                                onChangeText={setGroupName}
                            />
                        </View>

                        <View style={[styles.modalSearchBar, { marginTop: 10 }]}>
                            <SearchIcon width={20} height={20} color={COLORS.textSecondary} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search Members"
                                placeholderTextColor={COLORS.textSecondary}
                                value={memberSearchQuery}
                                onChangeText={setMemberSearchQuery}
                            />
                        </View>

                        {loadingMembers ? (
                            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
                        ) : (
                            <FlatList
                                data={filteredMembers}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMemberSelectionItem}
                                contentContainerStyle={[styles.membersList, { paddingBottom: 100 }]}
                                ListEmptyComponent={() => (
                                    <Text style={styles.membersEmptyText}>No members found.</Text>
                                )}
                            />
                        )}

                        <View style={styles.createGroupFooter}>
                            <TouchableOpacity
                                style={[
                                    styles.createGroupButton,
                                    (!groupName.trim() || selectedMemberIds.length === 0 || creatingGroup) && styles.createGroupButtonDisabled
                                ]}
                                onPress={createGroupChat}
                                disabled={!groupName.trim() || selectedMemberIds.length === 0 || creatingGroup}
                            >
                                {creatingGroup ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <Text style={styles.createGroupButtonText}>Create Group</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ModalSheet>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerAvatarWrapper: {
        marginRight: 12,
        position: 'relative',
    },
    headerStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: COLORS.background, // Match header background
        zIndex: 1,
    },
    headerAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    headerAvatarPlaceholder: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarInitial: {
        fontFamily: FONT_BODY,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.white,
    },
    headerTextWrapper: {
        flex: 1,
    },
    greetingText: {
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: '400',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    displayNameText: {
        fontFamily: FONT_HEADING,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 0.5,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerIconButtonSecond: {
        marginLeft: 10,
    },
    chatsTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginLeft: 20,
        marginTop: 20,
        marginBottom: 16,
        letterSpacing: 0.5,
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
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginLeft: 12,
        height: '100%',
    },
    listWrapper: {
        flex: 1,
    },
    listWrapperEmpty: {
        backgroundColor: 'transparent',
    },
    loadingWrapper: {
        padding: 40,
        alignItems: 'center',
    },
    flatListContent: {
        paddingBottom: 110,
        paddingHorizontal: 2,
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 10,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    chatMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
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
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        fontFamily: FONT_BODY,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    chatStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.white,
        zIndex: 1,
    },
    attachmentBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: COLORS.primary,
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
        color: COLORS.white,
    },
    chatContent: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameText: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        marginRight: 8,
    },
    dateText: {
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: '400',
        color: COLORS.textSecondary,
        flexShrink: 0,
        marginLeft: 8,
    },
    messageText: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: '400',
        color: COLORS.textSecondary,
        minWidth: 0,
    },
    unreadBadge: {
        backgroundColor: COLORS.primary,
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
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    emptyStateImage: {
        width: 300,
        height: 200,
        marginBottom: 10,
    },
    emptyStateText: {
        fontFamily: FONT_HEADING,
        fontSize: 14,
        color: "#5A5A5A",
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    modalContent: {
        flex: 1,
        backgroundColor: '#F7F7F9'
    },
    modalHeaderIconWrap: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -50,
        zIndex: 1,
    },
    modalHeaderImage: {
        width: '100%',
        height: '100%',
    },
    modalSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 60,
        marginBottom: 24,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    modalSearchInput: {
        flex: 1,
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginLeft: 12,
        padding: 0,
    },
    modalNewChatTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    membersList: {
        paddingBottom: 40,
    },
    membersEmptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: COLORS.textSecondary,
        fontFamily: FONT_BODY,
        fontSize: 14,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
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
    memberAvatarWrapper: {
        position: 'relative',
        marginRight: 16,
    },
    memberStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    memberAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberAvatarPlaceholderText: {
        fontFamily: FONT_BODY,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    memberName: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    optionsContent: {
        paddingVertical: 20,
    },
    optionButton: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#EEEEEE',
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    optionButtonText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    groupInputContainer: {
        marginHorizontal: 16,
        marginBottom: 10,
    },
    groupNameInput: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    memberItemSelected: {
        backgroundColor: '#E8F5E9',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.textSecondary,
        marginLeft: 'auto',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkmark: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    createGroupFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F7F7F9',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    createGroupButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    createGroupButtonDisabled: {
        opacity: 0.5,
    },
    createGroupButtonText: {
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
});

export default ChatList;
