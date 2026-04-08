-- ============================================================================
-- PERSISTENT CHAT HISTORY FOR ATLAS
-- Stores conversations per user, grouped by conversation_id
-- ============================================================================

CREATE TABLE public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT, -- auto-generated from first user message
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id, updated_at DESC);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at ASC);

-- RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users see own conversations"
    ON public.chat_conversations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only see messages from their own conversations
CREATE POLICY "Users see own messages"
    ON public.chat_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_conversations
            WHERE id = chat_messages.conversation_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_conversations
            WHERE id = chat_messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Auto-update updated_at on conversation when new message added
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_timestamp
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_timestamp();
