
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RoomStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

interface UpdateRoomParams {
    id: string;
    status: RoomStatus;
    notes?: string;
}

export const useUpdateRoom = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status, notes }: UpdateRoomParams) => {
            const updateData: { status: RoomStatus; notes?: string } = { status };

            // Include notes if provided, or clear them if status is not MAINTENANCE
            if (notes !== undefined) {
                updateData.notes = notes;
            } else if (status !== 'MAINTENANCE') {
                updateData.notes = null as any; // Clear notes when not in maintenance
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
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

            // Audit log
            logAuditEvent({
                entityType: 'room',
                entityId: variables.id,
                action: 'STATUS_CHANGE',
                description: `Habitación ${data?.room_number || ''} → ${variables.status}`,
                newValues: { status: variables.status, notes: variables.notes },
            });
        }
    });
};
