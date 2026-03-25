import { Navigate } from 'react-router-dom';
import { useAppRole } from '@/context/AppRoleContext';
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
    const { currentRole, profileLoading } = useAppRole();

    // While profile is loading, don't redirect — wait
    if (profileLoading) return null;

    if (!allowedRoles.includes(currentRole)) {
        // Redirect to a page the user CAN access
        const redirectTo = fallback || getFallbackRoute(currentRole);
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
}

/** Get the default landing page for each role */
function getFallbackRoute(role: UserRole): string {
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
