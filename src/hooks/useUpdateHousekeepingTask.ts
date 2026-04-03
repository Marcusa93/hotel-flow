
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { HousekeepingTask, HousekeepingStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

interface UpdateTaskParams {
    id: string;
    data: Partial<HousekeepingTask>;
    startedAt?: Date;
    completedAt?: Date;
}

export const useUpdateHousekeepingTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data, startedAt, completedAt }: UpdateTaskParams) => {
            const updates: Record<string, string | number | null> = {};

            if (data.status) updates.status = data.status;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.roomId) updates.room_id = data.roomId;
            if (data.date) updates.date = data.date instanceof Date ? data.date.toISOString() : data.date;
            if (data.priority) updates.priority = data.priority;
            if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo ?? null;

            // Time tracking — forward transitions
            if (startedAt) {
                updates.started_at = startedAt.toISOString();
            }

            if (completedAt) {
                updates.completed_at = completedAt.toISOString();

                // Calculate duration if we have started_at
                const { data: existingTask } = await supabase
                    .from('housekeeping_tasks')
                    .select('started_at')
                    .eq('id', id)
                    .single();

                if (existingTask?.started_at) {
                    const start = new Date(existingTask.started_at).getTime();
                    const end = completedAt.getTime();
                    updates.duration_minutes = Math.round((end - start) / 60000);
                } else {
                    // Task went directly TODO → DONE (skipping IN_PROGRESS)
                    updates.started_at = completedAt.toISOString();
                    updates.duration_minutes = 0;
                }
            }

            // Time tracking — reverse transitions (revert)
            if (data.status === 'TODO') {
                // Going back to TODO: clear all time tracking
                updates.started_at = null;
                updates.completed_at = null;
                updates.duration_minutes = null;
            } else if (data.status === 'IN_PROGRESS' && !startedAt && !completedAt) {
                // Reverting from DONE to IN_PROGRESS: clear completion, keep start
                updates.completed_at = null;
                updates.duration_minutes = null;
            }

            const { error } = await supabase
                .from('housekeeping_tasks')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            const action = variables.data.status ? 'STATUS_CHANGE' as const : 'UPDATE' as const;
            logAuditEvent({
                entityType: 'housekeeping_task',
                entityId: variables.id,
                action,
                description: variables.data.status
                    ? `Tarea de limpieza → ${variables.data.status}`
                    : `Tarea de limpieza actualizada`,
                newValues: { ...variables.data, startedAt: variables.startedAt?.toISOString(), completedAt: variables.completedAt?.toISOString() },
            });

            // Notifications for status changes
            if (variables.data.status === 'DONE') {
                createNotificationIfEnabled({
                    type: 'success',
                    category: 'housekeeping',
                    title: 'Limpieza completada',
                    message: `Tarea de limpieza finalizada correctamente`,
                    metadata: { taskId: variables.id },
                });
            } else if (variables.data.status === 'IN_PROGRESS') {
                createNotificationIfEnabled({
                    type: 'info',
                    category: 'housekeeping',
                    title: 'Limpieza en progreso',
                    message: `Tarea de limpieza iniciada`,
                    metadata: { taskId: variables.id },
                });
            }
        }
    });
};
