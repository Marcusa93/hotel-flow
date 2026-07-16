
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = useCallback(async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                // Remote sign-out failed — at least clear the localStorage
                // session so the next user on a shared machine starts clean.
                console.warn('Remote signOut failed, clearing local session:', error);
                await supabase.auth.signOut({ scope: 'local' });
            }
        } catch (e) {
            console.warn('signOut threw, clearing local session:', e);
            try {
                await supabase.auth.signOut({ scope: 'local' });
            } catch {
                // Ignore — state resets below still log the user out of the UI.
            }
        } finally {
            setSession(null);
            setUser(null);
            // Drop all cached data so the next user never sees stale info
            queryClient.clear();
        }
    }, []);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        signOut,
    }), [session, user, loading, signOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
