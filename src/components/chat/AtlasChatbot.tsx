
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Send, Loader2, Mic, MicOff, Plus, History, Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from '@/lib/supabase';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { useChatHistory } from '@/hooks/useChatHistory';
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

const CONFIRM_PATTERNS = [
    /¿(?:confirmo|procedemos|lo hago|lo creo|la creo|lo registro|la registro|querés que)/i,
    /¿(?:está bien|lo ejecuto|seguimos|lo aplico)/i,
    /¿(?:deseas|quiere|querés) (?:que |confirmar|proceder|continuar)/i,
];

function needsConfirmation(messages: ChatMessage[]): boolean {
    if (messages.length === 0) return false;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant') return false;
    return CONFIRM_PATTERNS.some(p => p.test(last.content));
}

const PAGE_LABELS: Record<string, string> = {
    '/': 'Dashboard',
    '/bookings': 'Lista de reservas',
    '/guests': 'Lista de huéspedes',
    '/rooms': 'Habitaciones',
    '/housekeeping': 'Housekeeping',
    '/payments': 'Pagos',
    '/expenses': 'Gastos',
    '/rates': 'Tarifas',
    '/notifications': 'Notificaciones',
    '/settings': 'Configuración',
    '/audit-log': 'Auditoría',
};

function getPageContext(pathname: string): string | null {
    // Specific booking detail
    const bookingMatch = pathname.match(/^\/bookings\/([a-f0-9-]+)$/i);
    if (bookingMatch) return `Estoy viendo el detalle de la reserva ID: ${bookingMatch[1]}`;

    // Specific guest detail
    const guestMatch = pathname.match(/^\/guests\/([a-f0-9-]+)$/i);
    if (guestMatch) return `Estoy viendo el perfil del huésped ID: ${guestMatch[1]}`;

    // Generic page
    const label = PAGE_LABELS[pathname];
    if (label) return `Estoy en la página: ${label}`;

    return null;
}

export function AtlasChatbot() {
    const { data: hotelSettings } = useHotelSettings();
    const location = useLocation();
    const {
        messages, setMessages, addMessage, persistMessage,
        conversations, switchConversation, newConversation,
        loadingHistory,
    } = useChatHistory();
    const [isOpen, setIsOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const briefingFetched = useRef(false);

    // Add greeting + auto-briefing when starting a new conversation
    useEffect(() => {
        if (!loadingHistory && messages.length === 0 && !briefingFetched.current) {
            briefingFetched.current = true;
            setMessages([{ role: 'assistant', content: getInitialGreeting(hotelSettings?.hotelName) }]);

            // Auto-fetch daily briefing
            (async () => {
                try {
                    setIsLoading(true);
                    const { data, error } = await supabase.functions.invoke('atlas-chat', {
                        body: {
                            message: 'Dame un resumen breve del día de hoy: check-ins, check-outs, habitaciones sucias, pagos pendientes. Sé conciso, usá bullets.',
                            history: [],
                        },
                    });
                    if (!error && data?.reply) {
                        await addMessage({ role: 'assistant', content: data.reply });
                    }
                } catch { /* silently skip briefing on error */ }
                finally { setIsLoading(false); }
            })();
        }
    }, [loadingHistory, hotelSettings?.hotelName]);
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

    const showQuickActions = !isLoading && needsConfirmation(messages);

    // Streaming assistant index — tracks which message to update during streaming
    const streamingIdx = useRef<number | null>(null);

    const sendToAtlas = async (text: string) => {
        if (isLoading) return;
        const userMessage: ChatMessage = { role: 'user', content: text };
        await addMessage(userMessage);
        setIsLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(
                `${supabaseUrl}/functions/v1/atlas-chat?stream=1`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token || anonKey}`,
                        'apikey': anonKey,
                    },
                    body: JSON.stringify({
                        message: text,
                        history: messages.slice(-20),
                        pageContext: getPageContext(location.pathname),
                    }),
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('text/event-stream') && response.body) {
                // Streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';

                // Add empty assistant message to stream into
                setMessages(prev => {
                    streamingIdx.current = prev.length;
                    return [...prev, { role: 'assistant', content: '' }];
                });

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;
                        const payload = trimmed.slice(6);
                        if (payload === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(payload);
                            if (parsed.token) {
                                fullText += parsed.token;
                                const text = fullText; // capture for closure
                                setMessages(prev => {
                                    const idx = streamingIdx.current;
                                    if (idx === null) return prev;
                                    const updated = [...prev];
                                    updated[idx] = { role: 'assistant', content: text };
                                    return updated;
                                });
                            }
                            if (parsed.error) throw new Error(parsed.error);
                        } catch { /* skip malformed */ }
                    }
                }

                // Persist final message to DB (state already has it from streaming)
                if (fullText) {
                    await persistMessage({ role: 'assistant', content: fullText });
                    streamingIdx.current = null;
                }
            } else {
                // Non-streaming JSON fallback
                const data = await response.json();
                const reply = data?.reply || 'Lo siento, no pude procesar tu consulta.';
                await addMessage({ role: 'assistant', content: reply });
            }
        } catch (err) {
            console.error('Atlas chat error:', err);
            await addMessage({
                role: 'assistant',
                content: 'Disculpá, tuve un problema de conexión. ¿Podés intentar de nuevo?',
            });
        } finally {
            setIsLoading(false);
            streamingIdx.current = null;
        }
    };

    const sendQuickReply = (text: string) => sendToAtlas(text);

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        setInput('');
        sendToAtlas(trimmed);
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
                            <img src="/bot.png" alt="Atlas" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Atlas</h3>
                            <span className="text-[10px] text-yellow-500 font-medium">
                                {isLoading ? 'Pensando...' : 'HoMe AI Assistant'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-white/70 hover:text-white h-8 w-8"
                            title="Historial"
                        >
                            <History className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => { newConversation(); setShowHistory(false); }}
                            className="text-white/70 hover:text-white h-8 w-8"
                            title="Nueva conversación"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={toggleChat} className="text-white/70 hover:text-white h-8 w-8">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Conversation History Panel */}
                {showHistory && (
                    <div className="border-b border-border bg-background px-3 py-2 max-h-48 overflow-y-auto">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Conversaciones recientes</p>
                        {conversations.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Sin conversaciones previas</p>
                        ) : (
                            <div className="space-y-1">
                                {conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => { switchConversation(conv.id); setShowHistory(false); }}
                                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-xs truncate transition-colors"
                                    >
                                        <span className="font-medium">{conv.title || 'Conversación'}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {new Date(conv.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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

                        {/* Quick action buttons */}
                        {showQuickActions && (
                            <div className="flex justify-start gap-2 pl-1">
                                <Button
                                    size="sm"
                                    onClick={() => sendQuickReply('Sí, confirmá')}
                                    className="text-xs h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Confirmar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendQuickReply('No, cancelá')}
                                    className="text-xs h-7 gap-1.5"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Cancelar
                                </Button>
                            </div>
                        )}

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
                <div className="p-4 bg-background border-t border-border mt-auto space-y-2">
                    {/* Suggestion chips — show when no user messages yet */}
                    {!isLoading && !messages.some(m => m.role === 'user') && (
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                '¿Quién está alojado?',
                                'Habitaciones disponibles',
                                'Resumen de pagos pendientes',
                                'Tareas de limpieza hoy',
                            ].map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => sendQuickReply(suggestion)}
                                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
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
                        src="/bot.png"
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
