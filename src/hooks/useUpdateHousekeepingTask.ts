
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { HousekeepingTask, HousekeepingStatus } from '@/types/hotel';

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
            const updates: any = {};

            if (data.status) updates.status = data.status;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.roomId) updates.room_id = data.roomId;
            if (data.date) updates.date = data.date.toISOString();
            if (data.priority) updates.priority = data.priority;
            if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo;

            // Time tracking
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
                }
            }

            const { error } = await supabase
                .from('housekeeping_tasks')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        }
    });
};
