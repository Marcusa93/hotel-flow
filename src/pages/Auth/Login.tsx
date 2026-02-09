
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login/Signup

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
                    description: "Revisa tu email para confirmar tu cuenta (si está habilitado) o inicia sesión.",
                });
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/');
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Ha ocurrido un error",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#003366] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-[#003366] to-[#003366] pointer-events-none" />

            {/* Golden glow effect top right */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-2xl shadow-2xl relative z-10 animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 ring-1 ring-white/20 flex items-center justify-center mb-4 shadow-lg">
                        <img src="/logo.png" alt="HoMe" className="w-10 h-10 object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">
                        HoMe
                    </h1>
                    <p className="text-blue-200/80 text-sm tracking-widest uppercase mt-1">
                        Panel de Control
                    </p>
                </div>

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
                            placeholder="admin@hotel.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-white/80">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-yellow-500/50"
                            placeholder="••••••••"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20 transition-all duration-300 transform hover:scale-[1.02]"
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
            <div className="absolute bottom-6 text-center text-white/20 text-xs">
                HoMe App powered by Atlas AI
            </div>
        </div>
    );
}
