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

// Standalone fire-and-forget helper (same pattern as createNotification)
export const logAuditEvent = async (params: CreateAuditLogParams) => {
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
      user_id: params.userId,
      user_email: params.userEmail,
      user_role: params.userRole,
    });

  if (error) {
    console.error('Failed to create audit log:', error);
  }
};
