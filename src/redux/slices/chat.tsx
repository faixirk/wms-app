import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';

export interface ApiUser {
    id: string;
    name?: string;
    username?: string;
    avatar?: string;
    status?: "online" | "away" | "offline" | "busy" | "dnd";
    lastSeen?: string;
}

export interface ApiMessage {
    id: string;
    chatId: string;
    senderId?: string;
    sender?: { id: string; username?: string; name?: string; avatar?: string };
    content?: string | null;
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string | null;
    deletedById?: string | null;
    fileName?: string | null;
    attachments?: any[];
    isRead?: boolean;
    /** Show "(edited)" label next to timestamp when true. */
    isEdited?: boolean;
    mentions?: string[];
}

export interface ApiChat {
    id: string;
    title?: string;
    name?: string;
    type: "DIRECT" | "GROUP" | "PROJECT" | "TASK";
    participants: ApiUser[];
    lastMessage?: ApiMessage;
    unreadCount?: number;
    avatar?: string;
    archivedAt?: string | null;
}

export interface ChatState {
    chats: ApiChat[];
    activeRoomMessages: { [chatId: string]: ApiMessage[] };
    onlineStatuses: { [userId: string]: { status: string; lastSeen?: string } };
    loadingChats: boolean;
    loadingMessages: { [chatId: string]: boolean };
    error: string | null;
}

const initialState: ChatState = {
    chats: [],
    activeRoomMessages: {},
    onlineStatuses: {},
    loadingChats: false,
    loadingMessages: {},
    error: null,
};

// --- REST THUNKS ---

export const fetchChatList = createAsyncThunk(
    'chat/fetchChatList',
    async (workspaceId: string, { rejectWithValue }) => {
        try {
            const response = await request<any>({
                url: ENDPOINTS.CHATS_LIST,
                method: 'GET',
                params: { workspaceId, includeArchived: true },
            });
            // Handle the nested items object if the API returns pagination/wrapper object
            const responseData = response?.data;
            if (Array.isArray(responseData)) return responseData;
            if (responseData?.data && Array.isArray(responseData.data)) return responseData.data;
            if (responseData?.items && Array.isArray(responseData.items)) return responseData.items;
            return [];
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch chats');
        }
    }
);

export const fetchChatMessages = createAsyncThunk(
    'chat/fetchChatMessages',
    async ({ workspaceId, chatId, cursor }: { workspaceId: string, chatId: string, cursor?: string }, { rejectWithValue }) => {
        try {
            const response = await request<any>({
                url: ENDPOINTS.CHAT_MESSAGES_DYNAMIC(chatId),
                method: 'GET',
                params: { workspaceId, cursor, limit: 30 },
            });
            const responseData = response?.data;
            let messages: ApiMessage[] = [];
            if (Array.isArray(responseData)) {
                messages = responseData;
            } else if (responseData?.data) {
                if (Array.isArray(responseData.data)) messages = responseData.data;
                else if (responseData.data?.items && Array.isArray(responseData.data.items)) messages = responseData.data.items;
            } else if (responseData?.items && Array.isArray(responseData.items)) {
                messages = responseData.items;
            }
            return { chatId, messages, overwrite: !cursor };
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch messages');
        }
    }
);


const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        // Socket Event Handlers & Local Mutations
        addMessageToRoom: (state, action: PayloadAction<{ chatId: string, message: ApiMessage }>) => {
            const { chatId, message } = action.payload;
            if (!state.activeRoomMessages[chatId]) {
                state.activeRoomMessages[chatId] = [];
            }
            // Assuming sorting or appending based on UI implementation - appending to end for now
            state.activeRoomMessages[chatId].push(message);

            // Update last message in chat list preview
            const chatIndex = state.chats.findIndex(c => c.id === chatId);
            if (chatIndex >= 0) {
                state.chats[chatIndex].lastMessage = message;
            }
        },
        updatePresence: (state, action: PayloadAction<{ userId: string, status: string, lastSeen?: string }>) => {
            state.onlineStatuses[action.payload.userId] = {
                status: action.payload.status,
                lastSeen: action.payload.lastSeen
            };
        },
        updateBulkPresence: (state, action: PayloadAction<Record<string, { status: string, lastSeen?: string }>>) => {
            state.onlineStatuses = { ...state.onlineStatuses, ...action.payload };
        },
        updateChatInList: (state, action: PayloadAction<ApiChat>) => {
            const index = state.chats.findIndex(c => c.id === action.payload.id);
            if (index >= 0) {
                state.chats[index] = action.payload;
            } else {
                state.chats.unshift(action.payload); // push new chat to top
            }
        },
        updateMessageInRoom: (state, action: PayloadAction<{ chatId: string; message: ApiMessage }>) => {
            const { chatId, message } = action.payload;
            const list = state.activeRoomMessages[chatId];
            if (!list) return;
            const idx = list.findIndex(m => m.id === message.id);
            if (idx >= 0) {
                state.activeRoomMessages[chatId][idx] = message;
            }
            const chatIndex = state.chats.findIndex(c => c.id === chatId);
            if (chatIndex >= 0 && state.chats[chatIndex].lastMessage?.id === message.id) {
                state.chats[chatIndex].lastMessage = message;
            }
        },
        removeChatFromList: (state, action: PayloadAction<string>) => {
            state.chats = state.chats.filter(c => c.id !== action.payload);
            delete state.activeRoomMessages[action.payload];
        },
        clearChatUnreadCount: (state, action: PayloadAction<string>) => {
            const chatIndex = state.chats.findIndex(c => c.id === action.payload);
            if (chatIndex >= 0) {
                state.chats[chatIndex].unreadCount = 0;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch Chats
            .addCase(fetchChatList.pending, (state) => {
                state.loadingChats = true;
                state.error = null;
            })
            .addCase(fetchChatList.fulfilled, (state, action) => {
                state.loadingChats = false;
                state.chats = action.payload;
            })
            .addCase(fetchChatList.rejected, (state, action) => {
                state.loadingChats = false;
                state.error = action.payload as string;
            })
            // Fetch Messages
            .addCase(fetchChatMessages.pending, (state, action) => {
                const { chatId } = action.meta.arg;
                state.loadingMessages[chatId] = true;
            })
            .addCase(fetchChatMessages.fulfilled, (state, action) => {
                const { chatId, messages, overwrite } = action.payload;
                state.loadingMessages[chatId] = false;
                if (overwrite) {
                    state.activeRoomMessages[chatId] = messages;
                } else {
                    // Prepend older messages for cursor pagination based on typical chat implementations
                    state.activeRoomMessages[chatId] = [...messages, ...(state.activeRoomMessages[chatId] || [])];
                }
            })
            .addCase(fetchChatMessages.rejected, (state, action) => {
                const { chatId } = action.meta.arg;
                state.loadingMessages[chatId] = false;
            });
    }
});

export const {
    addMessageToRoom,
    updatePresence,
    updateBulkPresence,
    updateChatInList,
    updateMessageInRoom,
    removeChatFromList,
    clearChatUnreadCount,
} = chatSlice.actions;

export default chatSlice.reducer;
