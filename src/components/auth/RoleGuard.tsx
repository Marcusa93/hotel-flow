import { Navigate } from 'react-router-dom';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { UserRole } from '@/types/hotel';

interface RoleGuardProps {
    allowedRoles: UserRole[];
    children: React.ReactNode;
    /** Where to redirect if role is not allowed. Defaults to '/' */
    fallback?: string;
}

/**
 * Restricts page access based on the user's role.
 * If the current role is not in `allowedRoles`, redirects to fallback.
 * Must be used inside AppRoleProvider.
 */
export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
    const { currentRole, profileLoading, profileError } = useAppRole();
    const { signOut } = useAuth();

    // While profile is loading, show a loading spinner
    if (profileLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // No role could be resolved (missing profile, invalid role, or fetch error).
    // Don't silently grant any access — ask the user to sign in again.
    if (currentRole === null) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-4 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <div>
                    <h2 className="text-lg font-semibold">No se pudo determinar tu rol</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {profileError
                            ? 'Hubo un problema al cargar tu perfil. Volvé a iniciar sesión.'
                            : 'Tu usuario no tiene un rol asignado. Pedí al administrador que lo configure.'}
                    </p>
                </div>
                <Button onClick={() => signOut()} variant="outline">
                    Cerrar sesión
                </Button>
            </div>
        );
    }

    if (!allowedRoles.includes(currentRole)) {
        // Redirect to a page the user CAN access
        const redirectTo = fallback || getFallbackRoute(currentRole);
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
}

/** Get the default landing page for each role */
export function getFallbackRoute(role: UserRole): string {
    switch (role) {
        case 'admin':
        case 'reception':
            return '/';
        case 'housekeeping':
            return '/housekeeping';
        case 'auditor':
            return '/payments';
        default:
            return '/';
    }
}
