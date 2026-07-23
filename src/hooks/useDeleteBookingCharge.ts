import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

interface DeleteParams {
    chargeId: string;
    bookingId: string;
}

export const useDeleteBookingCharge = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ chargeId }: DeleteParams) => {
            const { error } = await supabase
                .from('booking_charges')
                .delete()
                .eq('id', chargeId);

            if (error) throw error;
        },
        onSuccess: (_data, { chargeId }) => {
            // Por prefijo: refresca el detalle y también las listas que arman el
            // estado de pago con todos los cargos.
            queryClient.invalidateQueries({ queryKey: ['bookingCharges'] });
            logAuditEvent({
                entityType: 'booking_charge',
                entityId: chargeId,
                action: 'DELETE',
                description: 'Cargo eliminado de la reserva',
            });
        },
    });
};
