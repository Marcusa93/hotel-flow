
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, loading } = useAuth();
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

    return <>{children}</>;
}
