
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RoomStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import { formatLocalDate } from '@/lib/utils';

interface UpdateRoomParams {
    id: string;
    status: RoomStatus;
    notes?: string;
}

export const useUpdateRoom = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status, notes }: UpdateRoomParams) => {
            const updateData: { status: RoomStatus; notes?: string | null } = { status };

            // Include notes if provided, or clear them if status is not MAINTENANCE
            if (notes !== undefined) {
                updateData.notes = notes;
            } else if (status !== 'MAINTENANCE') {
                updateData.notes = null;
            }

            const { data, error } = await supabase
                .from('rooms')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: async (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });

            // Audit log
            logAuditEvent({
                entityType: 'room',
                entityId: variables.id,
                action: 'STATUS_CHANGE',
                description: `Habitación ${data?.room_number || ''} → ${variables.status}`,
                newValues: { status: variables.status, notes: variables.notes },
            });

            // Notification for relevant status changes
            if (variables.status === 'MAINTENANCE') {
                createNotificationIfEnabled({
                    type: 'warning',
                    category: 'system',
                    title: 'Habitación en mantenimiento',
                    message: `Habitación ${data?.room_number || ''} marcada en mantenimiento${variables.notes ? `: ${variables.notes}` : ''}`,
                    metadata: { roomId: variables.id, status: variables.status },
                });
            } else if (variables.status === 'DIRTY') {
                createNotificationIfEnabled({
                    type: 'info',
                    category: 'housekeeping',
                    title: 'Limpieza requerida',
                    message: `Habitación ${data?.room_number || ''} requiere limpieza`,
                    metadata: { roomId: variables.id, status: variables.status },
                });

                // Auto-create housekeeping task for dirty rooms (skip if one already exists today)
                const today = formatLocalDate(new Date());
                const { data: existing } = await supabase
                    .from('housekeeping_tasks')
                    .select('id')
                    .eq('room_id', variables.id)
                    .eq('date', today)
                    .neq('status', 'DONE')
                    .limit(1);

                if (!existing?.length) {
                    await supabase
                        .from('housekeeping_tasks')
                        .insert({
                            room_id: variables.id,
                            date: today,
                            status: 'TODO',
                            priority: 'NORMAL',
                            notes: 'Limpieza requerida',
                        });
                }
                queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
            }
        }
    });
};
