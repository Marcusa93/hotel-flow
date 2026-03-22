import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingCharge } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

type CreateBookingChargeParams = Omit<BookingCharge, 'id' | 'createdAt'>;

export const useCreateBookingCharge = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (chargeData: CreateBookingChargeParams) => {
            const { data, error } = await supabase
                .from('booking_charges')
                .insert({
                    booking_id: chargeData.bookingId,
                    category: chargeData.category,
                    description: chargeData.description,
                    amount: chargeData.amount,
                    quantity: chargeData.quantity,
                    created_by: chargeData.createdBy,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                bookingId: data.booking_id,
                category: data.category,
                description: data.description,
                amount: Number(data.amount),
                quantity: data.quantity,
                createdAt: new Date(data.created_at),
                createdBy: data.created_by,
            } as BookingCharge;
        },
        onSuccess: (charge) => {
            queryClient.invalidateQueries({ queryKey: ['bookingCharges', charge.bookingId] });
            logAuditEvent({
                entityType: 'booking_charge',
                entityId: charge.id,
                action: 'CREATE',
                description: `Cargo agregado: ${charge.category} - ${charge.description} ($${(charge.amount * charge.quantity).toLocaleString('es-AR')})`,
                newValues: { category: charge.category, amount: charge.amount, quantity: charge.quantity, description: charge.description },
            });
        },
    });
};
