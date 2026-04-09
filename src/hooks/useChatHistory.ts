import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

export function useChatHistory() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const savingRef = useRef(false);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (data) {
      setConversations(data.map(c => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updated_at,
      })));
    }
  }, [user]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (convId: string): Promise<ChatMessage[]> => {
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    return (data || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }, []);

  // On mount: load the most recent conversation or start fresh
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoadingHistory(true);
      await loadConversations();

      // Try to resume the most recent conversation from today
      const { data: recent } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('user_id', user.id)
        .gte('updated_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (recent) {
        const msgs = await loadMessages(recent.id);
        if (msgs.length > 0) {
          setConversationId(recent.id);
          setMessages(msgs);
          setLoadingHistory(false);
          return;
        }
      }

      // No recent conversation — start fresh (messages will be empty, greeting added by component)
      setConversationId(null);
      setMessages([]);
      setLoadingHistory(false);
    };

    init();
  }, [user, loadConversations, loadMessages]);

  // Create new conversation
  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;
    const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, title })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error creating conversation:', error);
      return null;
    }

    setConversationId(data.id);
    return data.id;
  }, [user]);

  // Save a message to the DB (fire-and-forget, non-blocking)
  const saveMessage = useCallback(async (convId: string, message: ChatMessage) => {
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: convId,
        role: message.role,
        content: message.content,
      });
  }, []);

  // Add message (handles conversation creation on first user message)
  const addMessage = useCallback(async (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);

    // Only persist user and assistant messages (skip greeting)
    let convId = conversationId;

    if (!convId && message.role === 'user') {
      // First user message — create conversation and save it
      convId = await createConversation(message.content);
      if (!convId) return;
    }

    if (convId) {
      saveMessage(convId, message);
    }
  }, [conversationId, createConversation, saveMessage]);

  // Switch to a different conversation
  const switchConversation = useCallback(async (convId: string) => {
    const msgs = await loadMessages(convId);
    setConversationId(convId);
    setMessages(msgs);
  }, [loadMessages]);

  // Start a new conversation
  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    loadConversations();
  }, [loadConversations]);

  // Persist a message without appending to state (for streaming where state is managed externally)
  const persistMessage = useCallback(async (message: ChatMessage) => {
    let convId = conversationId;
    if (!convId && message.role === 'user') {
      convId = await createConversation(message.content);
    }
    if (convId) {
      saveMessage(convId, message);
    }
  }, [conversationId, createConversation, saveMessage]);

  return {
    messages,
    setMessages,
    conversationId,
    conversations,
    loadingHistory,
    addMessage,
    persistMessage,
    switchConversation,
    newConversation,
    loadConversations,
  };
}
