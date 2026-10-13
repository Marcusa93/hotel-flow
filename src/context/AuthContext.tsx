
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    /** Entró por un mail de recuperación: todavía no eligió contraseña. */
    passwordRecovery: boolean;
    /** La eligió: se levanta el bloqueo. */
    clearPasswordRecovery: () => void;
    signOut: () => Promise<void>;
}

/**
 * Que el link de recuperación no se evada con un F5.
 *
 * El evento PASSWORD_RECOVERY llega una sola vez, cuando el cliente de Supabase
 * ve el token en la URL. Si eso viviera sólo en memoria, recargar la página
 * dejaba a alguien adentro con una sesión válida y sin contraseña que supiera:
 * justo lo que esta pantalla viene a evitar. Va en sessionStorage y no en
 * localStorage para que muera con la pestaña, como la sesión de recuperación.
 */
const RECOVERY_KEY = 'hotelflow:password-recovery';

const readRecoveryFlag = (): boolean => {
    try {
        return sessionStorage.getItem(RECOVERY_KEY) === '1';
    } catch {
        return false;  // Modo privado o cookies bloqueadas: no romper el login.
    }
};

const writeRecoveryFlag = (on: boolean) => {
    try {
        if (on) sessionStorage.setItem(RECOVERY_KEY, '1');
        else sessionStorage.removeItem(RECOVERY_KEY);
    } catch {
        // Sin dónde guardarlo, el bloqueo dura lo que dure la página.
    }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [passwordRecovery, setPasswordRecovery] = useState(readRecoveryFlag);

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
        } = supabase.auth.onAuthStateChange((event, session) => {
            // El link del mail de recuperación crea una sesión válida. Sin esto
            // el usuario entraba derecho a la app y seguía sin saber su
            // contraseña: el mail lo dejaba pasar, no lo dejaba elegir.
            if (event === 'PASSWORD_RECOVERY') {
                setPasswordRecovery(true);
                writeRecoveryFlag(true);
            }
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const clearPasswordRecovery = useCallback(() => {
        setPasswordRecovery(false);
        writeRecoveryFlag(false);
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
            setPasswordRecovery(false);
            writeRecoveryFlag(false);
            // Drop all cached data so the next user never sees stale info
            queryClient.clear();
        }
    }, []);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        passwordRecovery,
        clearPasswordRecovery,
        signOut,
    }), [session, user, loading, passwordRecovery, clearPasswordRecovery, signOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
