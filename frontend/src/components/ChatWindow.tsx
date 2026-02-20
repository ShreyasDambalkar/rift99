import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Send, Wifi, WifiOff, MessageCircle, X } from 'lucide-react';

interface ChatWindowProps {
    receiverId: string;
    receiverName: string;
    onClose?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ receiverId, receiverName, onClose }) => {
    const { user } = useAuth();
    const { messages, sendMessage, loadHistory, connected, markRead } = useChat();
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    // Filter messages for this conversation
    const convoMessages = messages.filter(m =>
        (m.sender_id === user?.id && m.receiver_id === receiverId) ||
        (m.sender_id === receiverId && m.receiver_id === user?.id)
    );

    // Load history when opening chat
    useEffect(() => {
        loadHistory(receiverId);
        markRead();
    }, [receiverId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [convoMessages.length]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage(receiverId, input.trim());
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full glass-card rounded-4xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-gradient-to-r from-biotech-purple/10 to-biotech-blue/10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-biotech-purple to-biotech-blue flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {receiverName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-display font-bold text-slate-800 text-sm">{receiverName}</p>
                        <p className="text-[10px] flex items-center gap-1">
                            {connected
                                ? <><Wifi className="h-2.5 w-2.5 text-emerald-500" /><span className="text-emerald-500 font-semibold">Live</span></>
                                : <><WifiOff className="h-2.5 w-2.5 text-slate-400" /><span className="text-slate-400">Connecting...</span></>
                            }
                        </p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-white/30 rounded-xl transition-colors">
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ minHeight: '300px', maxHeight: '450px' }}>
                {convoMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-biotech-purple/10 to-biotech-blue/10 flex items-center justify-center mb-4">
                            <MessageCircle className="h-6 w-6 text-biotech-purple" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">Start the conversation</p>
                        <p className="text-xs text-slate-400 mt-1">Messages are end-to-end delivered in real-time</p>
                    </div>
                )}

                {convoMessages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-3xl px-4 py-2.5 shadow-sm
                                ${isMine
                                    ? 'bg-gradient-to-br from-biotech-purple to-biotech-blue text-white rounded-tr-sm'
                                    : 'bg-white/70 backdrop-blur text-slate-700 border border-white/40 rounded-tl-sm'
                                }`}>
                                <p className="text-sm leading-relaxed">{msg.message}</p>
                                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60 text-right' : 'text-slate-400'}`}>
                                    {formatTime(msg.created_at)}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/30 p-4">
                <div className="flex gap-2 items-end">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        placeholder="Type a message... (Enter to send)"
                        className="flex-1 px-4 py-3 rounded-2xl border border-white/40 bg-white/50 text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-biotech-purple/30 transition-all"
                        style={{ maxHeight: '100px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || !connected}
                        className={`p-3 rounded-2xl transition-all flex-shrink-0
                            ${input.trim() && connected
                                ? 'bg-gradient-to-br from-biotech-purple to-biotech-blue text-white shadow-lg shadow-biotech-purple/30 hover:scale-105'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}>
                        <Send className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                    {connected ? 'Real-time · Messages are private and secure' : 'Connecting to chat server...'}
                </p>
            </div>
        </div>
    );
};
