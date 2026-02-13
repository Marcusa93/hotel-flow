
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

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
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Rooms might change status on check-in

            // Audit log
            logAuditEvent({
                entityType: 'booking',
                entityId: variables.id,
                action: 'STATUS_CHANGE',
                description: `Estado de reserva cambiado a ${variables.status}`,
                newValues: { status: variables.status },
            });
        }
    });
};
