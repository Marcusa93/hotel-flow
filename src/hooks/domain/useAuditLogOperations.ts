import { useCallback, useMemo } from 'react';
import { useAuditLogs, type UseAuditLogsOptions } from '@/hooks/useAuditLogs';
import type { AuditLog, AuditAction, AuditEntityType } from '@/types/hotel';

export function useAuditLogOperations(filters: UseAuditLogsOptions = {}) {
  const { data: auditLogs = [], isLoading, refetch } = useAuditLogs(filters);

  const logsByEntity = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    auditLogs.forEach(log => {
      const key = `${log.entityType}:${log.entityId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    });
    return map;
  }, [auditLogs]);

  const getLogsForEntity = useCallback(
    (entityType: AuditEntityType, entityId: string): AuditLog[] => {
      return logsByEntity.get(`${entityType}:${entityId}`) || [];
    },
    [logsByEntity]
  );

  const actionCounts = useMemo(() => {
    const counts: Record<AuditAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      STATUS_CHANGE: 0,
    };
    auditLogs.forEach(log => {
      counts[log.action]++;
    });
    return counts;
  }, [auditLogs]);

  const entityCounts = useMemo(() => {
    const counts: Partial<Record<AuditEntityType, number>> = {};
    auditLogs.forEach(log => {
      counts[log.entityType] = (counts[log.entityType] || 0) + 1;
    });
    return counts;
  }, [auditLogs]);

  return {
    auditLogs,
    isLoading,
    refetch,
    getLogsForEntity,
    actionCounts,
    entityCounts,
  };
}
