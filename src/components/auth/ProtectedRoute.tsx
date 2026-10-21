
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAppRole } from '@/context/AppRoleContext';
import { ForcePasswordChange } from '@/components/auth/ForcePasswordChange';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, loading, passwordRecovery } = useAuth();
    const { mustChangePassword, profileLoading } = useAppRole();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !session) {
            // Remember where the user was headed so Login can send them back
            navigate('/login', { state: { from: location } });
        }
    }, [session, loading, navigate, location]);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-sidebar">
                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
            </div>
        );
    }

    if (!session) {
        return null; // Will redirect via useEffect
    }

    // Dos formas de llegar acá sin una contraseña propia: la cuenta que creó un
    // admin con una temporal, y el que acaba de usar el link del mail de
    // recuperación. En los dos casos hay sesión válida y nada más de la app es
    // alcanzable hasta que elija una.
    if (passwordRecovery) {
        return <ForcePasswordChange reason="recovery" />;
    }
    if (!profileLoading && mustChangePassword) {
        return <ForcePasswordChange />;
    }

    return <>{children}</>;
}
