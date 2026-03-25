import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/hotel';

interface AppRoleContextType {
  currentRole: UserRole;
  profileLoading: boolean;
  profileName: string | null;
}

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

export function AppRoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            role: (user.user_metadata?.role as UserRole) || 'reception',
            fullName: (user.user_metadata?.full_name as string) || null,
          };
        }
        console.warn('Error fetching profile:', error.message);
        return null;
      }

      return {
        role: data.role as UserRole,
        fullName: data.full_name as string | null,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const currentRole: UserRole = profile?.role ?? 'reception';
  const profileName: string | null = profile?.fullName ?? null;

  const value = useMemo(() => ({
    currentRole,
    profileLoading,
    profileName,
  }), [currentRole, profileLoading, profileName]);

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
