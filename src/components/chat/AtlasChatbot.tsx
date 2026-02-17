
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export function AtlasChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
        { role: 'assistant', content: 'Hola, soy Atlas. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        // Mock response for now
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Estoy conectado a los sistemas del hotel. Pronto podré asistirte con IA real.' }]);
        }, 1000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            <div className={cn(
                "pointer-events-auto bg-card border border-border rounded-xl shadow-2xl transition-all duration-300 origin-bottom-right overflow-hidden flex flex-col mb-4",
                isOpen ? "w-[350px] h-[500px] opacity-100 scale-100" : "w-0 h-0 opacity-0 scale-50"
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
                            <span className="text-[10px] text-yellow-500 font-medium">HoMe AI Assistant</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={toggleChat} className="text-white/70 hover:text-white h-8 w-8">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={cn(
                                "flex w-full",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}>
                                <div className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                    msg.role === 'user'
                                        ? "bg-sidebar text-white rounded-br-none"
                                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 bg-background border-t border-border mt-auto">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                        <Input
                            placeholder="Escribe un mensaje..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="icon" className="bg-sidebar hover:bg-sidebar/80">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>

            {/* Floating Action Button (FAB) */}
            <button
                onClick={toggleChat}
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
