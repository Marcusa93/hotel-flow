
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAppRole } from '@/context/AppRoleContext';
import { getFallbackRoute } from '@/components/auth/RoleGuard';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { currentRole, profileLoading, profileError } = useAppRole();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login/Signup
    const [roleIssue, setRoleIssue] = useState<string | null>(null);

    // Redirect authenticated users to the landing page of their role.
    // Runs on initial mount (already-logged-in user lands on /login) and
    // after a successful signIn (session updates → this effect fires).
    // If the role can never be resolved, show an on-screen error instead
    // of leaving the user stranded on the login form.
    useEffect(() => {
        if (!user) {
            setRoleIssue(null);
            return;
        }
        if (profileLoading) return;
        if (currentRole) {
            // Prefer the page the user was originally trying to reach
            // (RoleGuard will re-redirect if the role can't access it).
            const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
            navigate(from && from !== '/login' ? from : getFallbackRoute(currentRole), { replace: true });
        } else {
            setRoleIssue(
                profileError
                    ? 'No pudimos cargar tu perfil. Reintentá en unos minutos o contactá al administrador.'
                    : 'Tu cuenta todavía no tiene acceso. Un administrador debe habilitar tu usuario.'
            );
        }
    }, [user, currentRole, profileLoading, profileError, navigate, location.state]);

    const handleForgotPassword = async () => {
        if (!email) {
            toast({
                variant: 'destructive',
                title: 'Ingresá tu email',
                description: 'Escribí tu email arriba y volvé a tocar "Olvidaste tu contraseña".',
            });
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
            toast({
                title: 'Listo — revisá tu email',
                description: `Te mandamos un link de recuperación a ${email}.`,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Ha ocurrido un error';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast({
                    title: "Cuenta creada",
                    description: "Un administrador debe habilitar tu acceso.",
                });
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Don't navigate here — the useEffect above handles it once
                // the role is resolved, so every role lands on the right page.
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Ha ocurrido un error";
            toast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-sidebar flex items-center justify-center p-4 relative overflow-hidden">
            {/* Atmospheric background — warm brass + deep ink */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-[-20%] right-[-10%] w-[560px] h-[560px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-soft" />
            <div className="absolute bottom-[-25%] left-[-10%] w-[480px] h-[480px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="brass-top w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-[1.75rem] shadow-2xl relative z-10 animate-fade-in overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(212,160,23,0.08),_transparent_60%)]">
                {/* El lockup ya trae el nombre y la bajada "Hotel Management
                    System", así que el título "HoMe" y el volanta "Gestión
                    Hotelera" que había acá decían lo mismo dos veces.

                    Va la variante clara: el logo original es navy sobre blanco
                    y este panel es navy oscuro, así que la mitad del isotipo
                    desaparecería. El dorado se mantiene sin tocar porque es lo
                    que ata la marca con los acentos de bronce de la app. */}
                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/brand-lockup-light.png"
                        alt="HomeApp — Hotel Management System"
                        className="w-52 h-auto"
                    />
                    {/* La página se queda sin encabezado si el nombre solo vive
                        dentro de una imagen. */}
                    <h1 className="sr-only">HomeApp — Iniciar sesión</h1>
                    <div className="mt-4 h-px w-16 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                </div>

                {roleIssue && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{roleIssue}</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-white/80">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-yellow-500/50"
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-white/80">Contraseña</Label>
                            {!isSignUp && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-[11px] text-white/50 hover:text-yellow-300 transition-colors disabled:opacity-50"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-yellow-500/50"
                            placeholder="Tu contraseña"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-white/50 text-sm hover:text-white transition-colors"
                    >
                        {isSignUp
                            ? '¿Ya tienes cuenta? Iniciar Sesión'
                            : '¿No tienes cuenta? Crear Cuenta'}
                    </button>
                </div>
            </div>

            {/* Footer / Branding */}
            <div className="absolute bottom-6 text-center text-amber-200/25 text-[11px] tracking-widest uppercase">
                HoMe · powered by Atlas AI
            </div>
        </div>
    );
}
