import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        },
    });
};
