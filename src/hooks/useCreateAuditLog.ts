import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AuditAction, AuditEntityType, UserRole } from '@/types/hotel';

export interface CreateAuditLogParams {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
}

export const useCreateAuditLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAuditLogParams) => {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          entity_type: params.entityType,
          entity_id: params.entityId,
          action: params.action,
          description: params.description,
          old_values: params.oldValues || {},
          new_values: params.newValues || {},
          metadata: params.metadata || {},
          user_id: params.userId,
          user_email: params.userEmail,
          user_role: params.userRole,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
};

// Auto-resolve current user info from Supabase Auth + profiles table
async function resolveCurrentUser(params: CreateAuditLogParams) {
  let userId = params.userId;
  let userEmail = params.userEmail;
  let userRole = params.userRole;

  if (!userId || !userEmail || !userRole) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = userId || user.id;
        userEmail = userEmail || user.email || undefined;

        // Resolve role from profiles table if not provided
        if (!userRole && user.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile?.role) {
            userRole = profile.role as UserRole;
          }
        }
      }
    } catch {
      // Silently fail — don't block audit logging
    }
  }

  return { userId, userEmail, userRole };
}

// Standalone fire-and-forget helper (same pattern as createNotification)
export const logAuditEvent = async (params: CreateAuditLogParams) => {
  const { userId, userEmail, userRole } = await resolveCurrentUser(params);

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      description: params.description,
      old_values: params.oldValues || {},
      new_values: params.newValues || {},
      metadata: params.metadata || {},
      user_id: userId,
      user_email: userEmail,
      user_role: userRole,
    });

  if (error) {
    console.error('Failed to create audit log:', error);
  }
};
