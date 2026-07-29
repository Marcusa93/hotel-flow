import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapRoom } from '@/lib/mappers';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import type { Room } from '@/types/hotel';

export interface SetHousekeepingHoldParams {
  roomId: string;
  /** Solo para los textos del aviso y la auditoría. */
  roomNumber?: string;
  /** true = no la habilito. */
  hold: boolean;
  /** Vacío o sin definir borra la nota anterior. */
  note?: string;
  /** Quién decide. Se guarda con la nota para que el aviso venga firmado. */
  by?: string;
}

/**
 * Limpieza habilita la habitación, la deja trabada, o la habilita dejando una
 * advertencia. Las tres cosas pasan por acá.
 *
 * El trigger de la base rechaza esto si lo manda recepción: el pedido era que
 * la habilitación fuera de limpieza y no de quien esté mirando la pantalla.
 */
export const useSetHousekeepingHold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetHousekeepingHoldParams): Promise<Room> => {
      const note = params.note?.trim() || null;

      const { data, error } = await supabase
        .from('rooms')
        .update({
          housekeeping_hold: params.hold,
          housekeeping_note: note,
          // La firma acompaña a la nota: sin nota tampoco hay a quién firmarle.
          housekeeping_note_by: note ? params.by || null : null,
          housekeeping_note_at: note || params.hold ? new Date().toISOString() : null,
        })
        .eq('id', params.roomId)
        .select()
        .single();

      if (error) throw error;

      return mapRoom(data);
    },
    onSuccess: (room, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      const numero = variables.roomNumber || room.roomNumber || '';
      const firma = variables.by ? ` (${variables.by})` : '';

      if (room.housekeepingHold) {
        createNotificationIfEnabled({
          type: 'warning',
          category: 'system',
          title: '🚫 Habitación no habilitada',
          message: `Limpieza no habilitó la ${numero}${firma}${room.housekeepingNote ? `: ${room.housekeepingNote}` : ''}`,
          metadata: { roomId: room.id },
          // Recepción es la que necesita enterarse: es la que iba a alojar a alguien ahí.
          targetRoles: ['admin', 'reception'],
        });
      } else if (room.housekeepingNote) {
        createNotificationIfEnabled({
          type: 'info',
          category: 'system',
          title: '📝 Aviso de limpieza',
          message: `Habitación ${numero} habilitada con una nota${firma}: ${room.housekeepingNote}`,
          metadata: { roomId: room.id },
          targetRoles: ['admin', 'reception'],
        });
      } else {
        // Se levantó el bloqueo. Vale avisar tanto como haberlo puesto:
        // recepción estaba esperando esa habitación.
        createNotificationIfEnabled({
          type: 'success',
          category: 'system',
          title: '✅ Habitación habilitada',
          message: `La ${numero} quedó habilitada${firma}`,
          metadata: { roomId: room.id },
          targetRoles: ['admin', 'reception'],
        });
      }

      logAuditEvent({
        entityType: 'room',
        entityId: room.id,
        action: 'STATUS_CHANGE',
        description: room.housekeepingHold
          ? `Habitación ${numero} NO habilitada por limpieza${room.housekeepingNote ? `: ${room.housekeepingNote}` : ''}`
          : `Habitación ${numero} habilitada por limpieza${room.housekeepingNote ? ` con nota: ${room.housekeepingNote}` : ''}`,
        newValues: { housekeepingHold: room.housekeepingHold, housekeepingNote: room.housekeepingNote },
      });
    },
  });
};
