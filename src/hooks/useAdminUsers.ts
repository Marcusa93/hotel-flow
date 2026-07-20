import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/hotel';

export interface AppUser {
  id: string;
  email: string | null;
  fullName: string | null;
  /** 'pending' means the account exists but has no access yet. */
  role: UserRole | 'pending';
  mustChangePassword: boolean;
  createdAt: Date | null;
}

export interface NewUserInput {
  email: string;
  password: string;
  fullName?: string;
  role: UserRole;
}

/**
 * Every profile in the system. Only admins can read more than their own row
 * (see the "Admins read all profiles" policy), so this is admin-only by design.
 */
export function useAppUsers(enabled = true) {
  return useQuery({
    queryKey: ['app-users'],
    queryFn: async (): Promise<AppUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, must_change_password, created_at')
        .order('role', { ascending: true });

      if (error) throw new Error(error.message);

      return (data || []).map((row) => ({
        id: row.id,
        email: row.email ?? null,
        fullName: row.full_name ?? null,
        role: row.role,
        mustChangePassword: row.must_change_password ?? false,
        createdAt: row.created_at ? new Date(row.created_at) : null,
      }));
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Creating an auth user needs the service_role key, so it goes through the
 * admin-create-user edge function rather than the browser client.
 */
export function useCreateAppUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewUserInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Tu sesión expiró. Volvé a iniciar sesión.');

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: input,
        headers: { Authorization: `Bearer ${token}` },
      });

      // invoke() surfaces non-2xx as an error whose body holds our message.
      if (error) {
        let message = error.message;
        try {
          const parsed = await (error as { context?: Response }).context?.json();
          if (parsed?.error) message = parsed.error;
        } catch {
          // Keep the generic message if the body isn't readable.
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      return data as { id: string; email: string; role: UserRole };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
    },
  });
}

/** Clears the forced-change flag after the user picks their own password. */
export function useCompletePasswordChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPassword: string) => {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw new Error(pwError.message);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('No se pudo identificar al usuario.');

      const { error } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
    },
  });
}
