
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !session) {
            navigate('/login');
        }
    }, [session, loading, navigate]);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#003366]">
                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
            </div>
        );
    }

    if (!session) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
