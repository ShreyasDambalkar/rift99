import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id: string;
    message: string;
    read: boolean;
    created_at: string;
}

interface ChatContextType {
    messages: ChatMessage[];
    sendMessage: (receiverId: string, text: string) => void;
    loadHistory: (receiverId: string) => Promise<void>;
    connected: boolean;
    unreadCount: number;
    markRead: () => void;
}

const ChatContext = createContext<ChatContextType>({
    messages: [],
    sendMessage: () => { },
    loadHistory: async () => { },
    connected: false,
    unreadCount: 0,
    markRead: () => { },
});

export const useChat = () => useContext(ChatContext);

/** Merge new messages into existing list — no duplicates, sorted by time */
const mergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
    const map = new Map(existing.map(m => [m.id, m]));
    incoming.forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef<WebSocket | null>(null);
    // Track which conversations have already been loaded so we don't reload on re-open
    const loadedConversations = useRef<Set<string>>(new Set());
    // Track the previous user id — only reset state when a DIFFERENT user logs in,
    // NOT when the same user's WebSocket temporarily drops and reconnects.
    const prevUserIdRef = useRef<string | null>(null);

    const userId = user?.id ?? null;

    // ── WebSocket connection ──────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        // Only wipe messages and conversation cache when a DIFFERENT user logs in.
        // If it's the same user reconnecting (e.g. WS blip / hot-reload), keep messages.
        if (prevUserIdRef.current !== userId) {
            prevUserIdRef.current = userId;
            loadedConversations.current.clear();
            setMessages([]);
        }

        const ws = new WebSocket(`ws://localhost:8000/ws/chat/${userId}`);
        socketRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            console.log('[Chat] Connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_message') {
                    const msg: ChatMessage = data.message;
                    setMessages(prev => mergeMessages(prev, [msg]));
                    setUnreadCount(prev => prev + 1);
                }
            } catch (e) {
                console.warn('[Chat] Bad WS message', e);
            }
        };

        ws.onerror = () => console.warn('[Chat] WebSocket error');
        ws.onclose = () => {
            setConnected(false);
            console.log('[Chat] Disconnected');
        };

        return () => { ws.close(); };
    }, [userId]); // depend on userId (primitive string), not the whole user object

    // ── Load history (only once per conversation) ──────────────────────
    const loadHistory = useCallback(async (receiverId: string) => {
        if (!user) return;
        if (loadedConversations.current.has(receiverId)) return; // already loaded
        loadedConversations.current.add(receiverId);

        try {
            const res = await fetch(`/api/chat/${receiverId}`, {
                headers: { 'x-user-id': user.id }
            });
            if (res.ok) {
                const data: ChatMessage[] = await res.json();
                // MERGE — don't overwrite (preserves optimistic + real-time messages)
                setMessages(prev => mergeMessages(prev, data));
            }
        } catch (err) {
            console.error('[Chat] Failed to load history:', err);
        }
    }, [userId]);

    // ── Send a message ──────────────────────────────────────────────────
    const sendMessage = useCallback((receiverId: string, text: string) => {
        if (!user || !text.trim()) return;

        // Optimistic update — shows instantly in sender's UI
        const optimisticId = `temp-${Date.now()}`;
        const optimistic: ChatMessage = {
            id: optimisticId,
            sender_id: user.id,
            receiver_id: receiverId,
            message: text.trim(),
            read: false,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimistic]);

        // Persist + emit to receiver via backend
        fetch('/api/chat/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id,
            },
            body: JSON.stringify({ receiver_id: receiverId, message: text.trim() }),
        }).then(async (res) => {
            if (res.ok) {
                const saved: ChatMessage = await res.json();
                // Replace optimistic temp message with real DB record
                setMessages(prev => prev.map(m => m.id === optimisticId ? saved : m));
            }
        }).catch(err => {
            console.error('[Chat] Send failed:', err);
            // Remove failed optimistic message
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
        });
    }, [userId]);

    const markRead = useCallback(() => setUnreadCount(0), []);

    return (
        <ChatContext.Provider value={{ messages, sendMessage, loadHistory, connected, unreadCount, markRead }}>
            {children}
        </ChatContext.Provider>
    );
};