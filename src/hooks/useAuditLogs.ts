import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapAuditLog } from '@/lib/mappers';
import type { AuditLog, AuditAction, AuditEntityType } from '@/types/hotel';

export interface UseAuditLogsOptions {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  limit?: number;
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const { entityType, entityId, action, dateFrom, dateTo, userId, limit = 200 } = options;

  return useQuery<AuditLog[]>({
    queryKey: ['auditLogs', { entityType, entityId, action, dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString(), userId, limit }],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      if (action) query = query.eq('action', action);
      if (userId) query = query.eq('user_id', userId);
      if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
      if (dateTo) query = query.lte('created_at', dateTo.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(mapAuditLog);
    },
    staleTime: 30 * 1000,
  });
};
