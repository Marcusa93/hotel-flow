import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/hotel';

export interface Profile {
    id: string;
    role: UserRole;
    fullName: string | null;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Fetches a user profile from the `profiles` table by user ID.
 * Use this in components that already have the userId available.
 */
export const useProfile = (userId: string | undefined) => {
    return useQuery<Profile | null>({
        // NOTE: distinct from AppRoleContext's ['profile', userId] key — this
        // hook returns a different shape, so sharing the key would collide.
        queryKey: ['profile-full', userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw error;
            }

            return {
                id: data.id,
                role: data.role as UserRole,
                fullName: data.full_name,
                email: data.email,
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at),
            };
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });
};
