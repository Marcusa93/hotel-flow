import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapLogbookEntry } from '@/lib/mappers';
import { LOGBOOK_CATEGORY_LABELS } from '@/lib/constants';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import type { LogbookCategory, LogbookEntry, LogbookStatus } from '@/types/hotel';

/** Toda la planilla. Se filtra en memoria; no da para paginar todavía. */
export const useLogbookEntries = () => {
  return useQuery<LogbookEntry[]>({
    queryKey: ['logbookEntries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_entries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapLogbookEntry);
    },
  });
};

export interface CreateLogbookEntryParams {
  date: Date;
  category: LogbookCategory;
  note: string;
  roomFromId?: string;
  roomToId?: string;
  /** INFO o PENDING. RESOLVED no se carga de entrada: no hubo nada que resolver. */
  status: Extract<LogbookStatus, 'INFO' | 'PENDING'>;
  createdBy?: string;
  createdByName?: string;
  /** Solo para el aviso, no se guarda. */
  roomLabel?: string;
}

export const useCreateLogbookEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLogbookEntryParams) => {
      const { data, error } = await supabase
        .from('logbook_entries')
        .insert({
          date: params.date.toISOString(),
          category: params.category,
          note: params.note.trim(),
          room_from_id: params.roomFromId || null,
          room_to_id: params.roomToId || null,
          status: params.status,
          created_by: params.createdBy || null,
          created_by_name: params.createdByName || null,
        })
        .select()
        .single();

      if (error) throw error;

      return mapLogbookEntry(data);
    },
    onSuccess: (entry, variables) => {
      queryClient.invalidateQueries({ queryKey: ['logbookEntries'] });

      // Solo lo pendiente avisa. Una anotación es para leer cuando se entra al
      // turno; mandar campanita por cada toalla sería enseñarle a la gente a
      // ignorar la campanita.
      if (entry.status === 'PENDING') {
        const donde = variables.roomLabel ? ` — ${variables.roomLabel}` : '';
        createNotificationIfEnabled({
          type: 'warning',
          category: 'system',
          title: '📋 Novedad pendiente',
          message: `${LOGBOOK_CATEGORY_LABELS[entry.category] || entry.category}: ${entry.note}${donde}`,
          metadata: { logbookEntryId: entry.id },
          // La planilla es de los tres: limpieza anota y recepción levanta, y al revés.
          targetRoles: ['admin', 'reception', 'housekeeping'],
          // Campanita sí, push no: una novedad se lee al entrar al turno, no
          // hace falta vibrarle el teléfono a nadie.
        });
      }

      logAuditEvent({
        entityType: 'logbook_entry',
        entityId: entry.id,
        action: 'CREATE',
        description: `Novedad anotada (${LOGBOOK_CATEGORY_LABELS[entry.category] || entry.category}): ${entry.note}`,
        newValues: { category: entry.category, status: entry.status, note: entry.note },
      });
    },
  });
};

export interface UpdateLogbookEntryParams {
  id: string;
  date?: Date;
  category?: LogbookCategory;
  note?: string;
  roomFromId?: string | null;
  roomToId?: string | null;
  status?: LogbookStatus;
  /** Quién resuelve. Solo se usa cuando el status pasa a RESOLVED. */
  resolvedBy?: string;
  resolvedByName?: string;
}

export const useUpdateLogbookEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateLogbookEntryParams) => {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (params.date !== undefined) row.date = params.date.toISOString();
      if (params.category !== undefined) row.category = params.category;
      if (params.note !== undefined) row.note = params.note.trim();
      if (params.roomFromId !== undefined) row.room_from_id = params.roomFromId || null;
      if (params.roomToId !== undefined) row.room_to_id = params.roomToId || null;

      if (params.status !== undefined) {
        row.status = params.status;

        if (params.status === 'RESOLVED') {
          // La base exige la fecha para marcar resuelta, y con razón: sin ella
          // la planilla dice que algo se solucionó y no cuándo.
          row.resolved_at = new Date().toISOString();
          row.resolved_by = params.resolvedBy || null;
          row.resolved_by_name = params.resolvedByName || null;
        } else {
          // Volver atrás limpia la firma: si no, queda diciendo que la resolvió
          // alguien que después la reabrió.
          row.resolved_at = null;
          row.resolved_by = null;
          row.resolved_by_name = null;
        }
      }

      const { data, error } = await supabase
        .from('logbook_entries')
        .update(row)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;

      return mapLogbookEntry(data);
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['logbookEntries'] });

      logAuditEvent({
        entityType: 'logbook_entry',
        entityId: entry.id,
        action: entry.status === 'RESOLVED' ? 'STATUS_CHANGE' : 'UPDATE',
        description: entry.status === 'RESOLVED'
          ? `Novedad resuelta: ${entry.note}`
          : `Novedad editada: ${entry.note}`,
        newValues: { category: entry.category, status: entry.status, note: entry.note },
      });
    },
  });
};

export const useDeleteLogbookEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: LogbookEntry) => {
      const { error } = await supabase
        .from('logbook_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      return entry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['logbookEntries'] });

      logAuditEvent({
        entityType: 'logbook_entry',
        entityId: entry.id,
        action: 'DELETE',
        description: `Novedad eliminada: ${entry.note}`,
        oldValues: { category: entry.category, status: entry.status, note: entry.note },
      });
    },
  });
};
