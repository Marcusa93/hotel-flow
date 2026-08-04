import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBookingCharge } from '@/lib/mappers';
import { logAuditEvent } from './useCreateAuditLog';
import type { ChargeCategory } from '@/types/hotel';

interface UpdateParams {
    chargeId: string;
    description?: string;
    category?: ChargeCategory;
    amount?: number;
    quantity?: number;
}

/**
 * Corregir un cargo ya cargado.
 *
 * Hasta acá solo se podía borrar y volver a cargar, que para arreglar un monto
 * mal tecleado pierde la hora en que se consumió de verdad. Y hace falta además
 * para el check-out anticipado: cuando el huésped se va antes, las noches
 * agregadas por "Extender estadía" se devuelven bajándole la cantidad al cargo,
 * sin tocar el precio al que se pactaron.
 */
export const useUpdateBookingCharge = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ chargeId, ...fields }: UpdateParams) => {
            const row: Record<string, unknown> = {};
            if (fields.description !== undefined) row.description = fields.description;
            if (fields.category !== undefined) row.category = fields.category;
            if (fields.amount !== undefined) row.amount = fields.amount;
            if (fields.quantity !== undefined) row.quantity = fields.quantity;

            const { data, error } = await supabase
                .from('booking_charges')
                .update(row)
                .eq('id', chargeId)
                .select()
                .single();

            if (error) throw error;
            return mapBookingCharge(data);
        },
        onSuccess: (charge, { chargeId, ...fields }) => {
            // Por prefijo: refresca el detalle y también las listas que arman el
            // estado de pago con todos los cargos.
            queryClient.invalidateQueries({ queryKey: ['bookingCharges'] });
            logAuditEvent({
                entityType: 'booking_charge',
                entityId: chargeId,
                action: 'UPDATE',
                description: `Cargo corregido: ${charge.description} — $${(charge.amount * charge.quantity).toLocaleString('es-AR')}`,
                newValues: fields,
            });
        },
    });
};
