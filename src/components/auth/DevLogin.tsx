
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function DevLogin() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // For dev purposes, we use magic link.
            // In a real app, this would be a full auth form.
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
            });

            if (error) throw error;
            setMessage('Check your email for the login link!');
        } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : 'Error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border-t border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Dev Auth</h3>
            <form onSubmit={handleLogin} className="space-y-2">
                <input
                    type="email"
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                >
                    {loading ? 'Sending...' : 'Send Magic Link'}
                </button>
                {message && <p className="text-xs text-green-400 mt-1">{message}</p>}
            </form>
        </div>
    );
}
