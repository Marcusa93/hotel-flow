import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

// Statuses that block deletion — finished bookings (CHECKED_OUT, CANCELLED,
// NO_SHOW) are preserved via ON DELETE SET NULL and don't prevent it.
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

export class GuestHasBookingsError extends Error {
    public bookingCount: number;
    constructor(count: number) {
        super(`El huésped tiene ${count} reserva(s) activa(s). Finalice o cancele las reservas primero.`);
        this.name = 'GuestHasBookingsError';
        this.bookingCount = count;
    }
}

export const useDeleteGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // Check for ACTIVE bookings before deleting — history is kept
            const { count, error: countError } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('guest_id', id)
                .in('status', ACTIVE_BOOKING_STATUSES);

            if (countError) throw countError;

            if (count && count > 0) {
                throw new GuestHasBookingsError(count);
            }

            const { error } = await supabase
                .from('guests')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['guests'] });
            logAuditEvent({
                entityType: 'guest',
                entityId: id,
                action: 'DELETE',
                description: `Huésped eliminado`,
            });
        },
    });
};
