import { io, Socket } from 'socket.io-client';
import type { DefaultEventsMap } from '@socket.io/component-emitter';

// Replace with your actual base URL or environment variable
const SOCKET_URL = 'https://api.wms365.ai';

class SocketService {
    private socket: Socket<DefaultEventsMap, DefaultEventsMap> | null = null;
    private workspaceId: string | null = null;

    /**
     * Initialize connection with the backend socket server
     */
    public connect(token: string, workspaceId: string): void {
        this.workspaceId = workspaceId;

        if (this.socket) {
            this.disconnect();
        }

        this.socket = io(SOCKET_URL, {
            auth: {
                token,
                workspaceId,
            },
            transports: ['websocket'],
            autoConnect: true,
        });

        this.socket.on('connect', () => {
            console.log(`[Socket] Connected with ID: ${this.socket?.id}`);
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnected. Reason: ${reason}`);
        });

        this.socket.on('connect_error', (error) => {
            console.error(`[Socket] Connection Error: ${error.message}`);
        });
    }

    /**
     * Terminate the connection
     */
    public disconnect(): void {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
            this.workspaceId = null;
            console.log('[Socket] Disconnected manually');
        }
    }

    /**
     * Safe getter for emit ensuring workspace ID is inherently attached where required
     */
    public emit(event: string, payload: any = {}): void {
        if (!this.socket?.connected) {
            console.warn(`[Socket] Attempting to emit to unconnected socket: ${event}`);
            return;
        }

        // Auto-inject workspaceId into emitted payloads if it's an object
        const enhancedPayload = typeof payload === 'object'
            ? { ...payload, workspaceId: this.workspaceId }
            : payload;

        this.socket.emit(event, enhancedPayload);
    }

    /**
     * Listener binding
     */
    public on(event: string, callback: (data: any) => void): void {
        if (!this.socket) return;
        this.socket.on(event, callback);
    }

    /**
     * Clean up specific listener
     */
    public off(event: string, callback?: (data: any) => void): void {
        if (!this.socket) return;
        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
    }
}

// Export singleton instance
export const socketService = new SocketService();
