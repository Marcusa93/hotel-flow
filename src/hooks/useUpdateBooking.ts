
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingStatus } from '@/types/hotel';

interface UpdateBookingStatusParams {
    id: string;
    status: BookingStatus;
}

export const useUpdateBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: UpdateBookingStatusParams) => {
            const { data, error } = await supabase
                .from('bookings')
                .update({ status })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Rooms might change status on check-in
        }
    });
};
