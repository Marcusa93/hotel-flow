import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

interface CreateRoomParams {
    roomNumber: string;
    roomTypeId: string;
    floor: number;
    status?: string;
    notes?: string;
}

export const useCreateRoom = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ roomNumber, roomTypeId, floor, status = 'AVAILABLE', notes }: CreateRoomParams) => {
            const { data, error } = await supabase
                .from('rooms')
                .insert({
                    room_number: roomNumber,
                    room_type_id: roomTypeId,
                    floor,
                    status,
                    notes: notes || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            logAuditEvent({
                entityType: 'room',
                entityId: data.id,
                action: 'CREATE',
                description: `Habitación ${variables.roomNumber} creada (piso ${variables.floor})`,
                newValues: { roomNumber: variables.roomNumber, floor: variables.floor, status: variables.status || 'AVAILABLE' },
            });
        },
    });
};
