
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Send, Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from '@/lib/supabase';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { ChatMarkdown } from './ChatMarkdown';

// ── Web Speech API types ──
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
}
interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

const getSpeechRecognition = (): (new () => SpeechRecognitionInstance) | null => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

function getInitialGreeting(hotelName?: string) {
    const name = hotelName || 'tu hotel';
    return `¡Hola! Soy Atlas, tu asistente de ${name}. Tengo acceso a todos los datos del sistema en tiempo real. ¿En qué puedo ayudarte?`;
}

const CHAT_STORAGE_KEY = 'atlas_chat_history';

function loadChatHistory(): ChatMessage[] | null {
    try {
        const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
}

function saveChatHistory(messages: ChatMessage[]) {
    try { sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
}

export function AtlasChatbot() {
    const { data: hotelSettings } = useHotelSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        return loadChatHistory() || [{ role: 'assistant', content: getInitialGreeting() }];
    });

    // Update initial greeting when hotel settings load (only if no chat history)
    useEffect(() => {
        if (hotelSettings?.hotelName && messages.length === 1 && messages[0].role === 'assistant' && !loadChatHistory()) {
            setMessages([{ role: 'assistant', content: getInitialGreeting(hotelSettings.hotelName) }]);
        }
    }, [hotelSettings?.hotelName]);

    // Persist messages to sessionStorage
    useEffect(() => {
        if (messages.length > 1) saveChatHistory(messages);
    }, [messages]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const speechSupported = !!getSpeechRecognition();

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const startListening = useCallback(() => {
        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) return;

        // Stop any existing session
        stopListening();

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            setIsListening(true);
            setInterimTranscript('');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (final) {
                setInput(prev => (prev ? prev + ' ' : '') + final);
                setInterimTranscript('');
            } else {
                setInterimTranscript(interim);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // 'no-speech' and 'aborted' are not real errors
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.warn('Speech recognition error:', event.error);
            }
            stopListening();
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript('');
            recognitionRef.current = null;
            inputRef.current?.focus();
        };

        recognition.start();
    }, [stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => { stopListening(); };
    }, [stopListening]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isLoading]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Send to Edge Function with conversation history
            const { data, error } = await supabase.functions.invoke('atlas-chat', {
                body: {
                    message: trimmed,
                    history: messages.slice(-20), // Last 20 messages for context
                },
            });

            if (error) throw error;

            const reply = data?.reply || 'Lo siento, no pude procesar tu consulta.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (err) {
            console.error('Atlas chat error:', err);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'Disculpá, tuve un problema de conexión. ¿Podés intentar de nuevo?',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] flex flex-col items-end pointer-events-none">
            {/* Chat Window — full screen on mobile, floating on desktop */}
            <div className={cn(
                "pointer-events-auto bg-card border border-border rounded-xl shadow-2xl transition-all duration-300 origin-bottom-right overflow-hidden flex flex-col mb-4",
                isOpen
                    ? "w-[calc(100vw-2rem)] md:w-[380px] h-[calc(100vh-10rem)] md:h-[540px] opacity-100 scale-100"
                    : "w-0 h-0 opacity-0 scale-50"
            )}>
                {/* Header */}
                <div className="bg-sidebar p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Atlas Avatar Small */}
                        <div className="relative w-8 h-8 rounded-full border border-yellow-500 overflow-hidden shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                            <img src="/atlas.png" alt="Atlas" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Atlas</h3>
                            <span className="text-[10px] text-yellow-500 font-medium">
                                {isLoading ? 'Pensando...' : 'HoMe AI Assistant'}
                            </span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={toggleChat} className="text-white/70 hover:text-white h-8 w-8">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50" ref={scrollRef}>
                    <div className="space-y-4" aria-live="polite" aria-label="Mensajes del chat">
                        {messages.map((msg, i) => (
                            <div key={i} className={cn(
                                "flex w-full",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}>
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                    msg.role === 'user'
                                        ? "bg-sidebar text-white rounded-br-none"
                                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm"
                                )}>
                                    <ChatMarkdown content={msg.content} isUser={msg.role === 'user'} />
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none shadow-sm px-4 py-3">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-xs">Atlas está consultando los datos...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 bg-background border-t border-border mt-auto space-y-1">
                    {/* Listening indicator */}
                    {isListening && (
                        <div className="flex items-center gap-2 px-2 pb-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                            <span className="text-[11px] text-muted-foreground italic truncate">
                                {interimTranscript || 'Escuchando...'}
                            </span>
                        </div>
                    )}
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                        <Input
                            ref={inputRef}
                            placeholder={isListening ? 'Hablá, te escucho...' : 'Escribe un mensaje...'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="flex-1"
                            disabled={isLoading}
                        />
                        {/* Mic button — only shown if browser supports Web Speech API */}
                        {speechSupported && (
                            <Button
                                type="button"
                                size="icon"
                                variant={isListening ? "destructive" : "outline"}
                                onClick={isListening ? stopListening : startListening}
                                disabled={isLoading}
                                className={cn(
                                    "shrink-0 transition-all",
                                    isListening && "animate-pulse"
                                )}
                                aria-label={isListening ? 'Detener micrófono' : 'Activar micrófono'}
                            >
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            size="icon"
                            className="bg-sidebar hover:bg-sidebar/80 shrink-0"
                            disabled={isLoading || !input.trim()}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Floating Action Button (FAB) */}
            <button
                onClick={toggleChat}
                aria-label={isOpen ? 'Cerrar chat de Atlas' : 'Abrir chat de Atlas'}
                className="pointer-events-auto group relative flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
                {/* Golden Radiant Effect */}
                <div className="absolute inset-0 rounded-full bg-yellow-500/30 blur-xl animate-pulse group-hover:bg-yellow-400/50 transition-colors" />

                {/* Main Circle container with Pillars Concept */}
                <div className="relative w-16 h-16 rounded-full bg-sidebar border-2 border-yellow-500 shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center justify-center overflow-hidden">

                    {/* "Pillars" simulated by vertical borders/gradients on the sides inside the circle */}
                    <div className="absolute left-1 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-600 via-yellow-300 to-yellow-600 opacity-80" />
                    <div className="absolute right-1 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-600 via-yellow-300 to-yellow-600 opacity-80" />

                    {/* Avatar Image */}
                    <img
                        src="/atlas.png"
                        alt="Atlas Chatbot"
                        className="w-full h-full object-cover p-1.5 z-10"
                        onError={(e) => {
                            // Fallback if image fails
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.classList.add('fallback-icon');
                        }}
                    />
                    {/* Fallback Icon (hidden by default unless image fails) */}
                    <MessageSquare className="w-8 h-8 text-yellow-500 hidden group-[.fallback-icon]:block relative z-0" />
                </div>

                {/* Notification Badge */}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                    </span>
                )}
            </button>
        </div>
    );
}
