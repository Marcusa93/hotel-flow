import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

export class GuestHasBookingsError extends Error {
    public bookingCount: number;
    constructor(count: number) {
        super(`El huésped tiene ${count} reserva(s) asociada(s). Elimine o reasigne las reservas primero.`);
        this.name = 'GuestHasBookingsError';
        this.bookingCount = count;
    }
}

export const useDeleteGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // Check for existing bookings before deleting
            const { count, error: countError } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('guest_id', id);

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
