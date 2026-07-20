import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/hotel';

interface AppRoleContextType {
  /** null while loading, on error, or when the user has no resolvable role. */
  currentRole: UserRole | null;
  profileLoading: boolean;
  profileError: Error | null;
  profileName: string | null;
  /** True when an admin created this account and the user still has the handed-over password. */
  mustChangePassword: boolean;
}

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

const VALID_ROLES: UserRole[] = ['admin', 'reception', 'housekeeping', 'auditor'];
const isValidRole = (r: unknown): r is UserRole =>
  typeof r === 'string' && (VALID_ROLES as string[]).includes(r);

export function AppRoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const metadataRole = user.user_metadata?.role;
      const metadataName = (user.user_metadata?.full_name as string) || null;

      if (error) {
        // PGRST116 = row not found, 42P01 = table doesn't exist.
        // Fall back to auth metadata ONLY if the metadata role is valid.
        // Do NOT default to 'reception' — that would silently grant privileges.
        const softFailure = error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist');
        if (softFailure && isValidRole(metadataRole)) {
          return { role: metadataRole, fullName: metadataName, mustChangePassword: false };
        }
        if (softFailure) {
          // Authenticated but no role anywhere — let the UI show an error.
          return { role: null, fullName: metadataName, mustChangePassword: false };
        }
        // Network or permission error — propagate so React Query retries.
        throw new Error(`Profile fetch failed: ${error.message}`);
      }

      return {
        role: isValidRole(data.role) ? data.role : null,
        fullName: (data.full_name as string | null) ?? null,
        mustChangePassword: data.must_change_password === true,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const currentRole: UserRole | null = profile?.role ?? null;
  const profileName: string | null = profile?.fullName ?? null;
  const mustChangePassword: boolean = profile?.mustChangePassword ?? false;
  const profileError = (error as Error | null) ?? null;

  const value = useMemo(() => ({
    currentRole,
    profileLoading,
    profileError,
    profileName,
    mustChangePassword,
  }), [currentRole, profileLoading, profileError, profileName, mustChangePassword]);

  return (
    <AppRoleContext.Provider value={value}>
      {children}
    </AppRoleContext.Provider>
  );
}

export function useAppRole() {
  const context = useContext(AppRoleContext);
  if (context === undefined) {
    throw new Error('useAppRole must be used within an AppRoleProvider');
  }
  return context;
}
