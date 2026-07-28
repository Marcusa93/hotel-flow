
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Guest, GuestRating } from '@/types/hotel';
import { GUEST_RATING_LABELS } from '@/lib/constants';
import { logAuditEvent } from './useCreateAuditLog';

interface UpdateGuestParams {
    id: string;
    /**
     * Los campos de calificación aceptan null además de undefined, y no es lo
     * mismo: undefined deja el campo como está, null lo borra. Sin esa
     * diferencia no habría forma de sacar una calificación puesta de más.
     */
    data: Partial<Guest> & {
        rating?: GuestRating | null;
        ratingNotes?: string | null;
        ratingBy?: string | null;
        ratingAt?: Date | null;
    };
}

export const useUpdateGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdateGuestParams) => {
            const updates: Record<string, any> = {};

            if (data.fullName !== undefined) updates.full_name = data.fullName;
            if (data.documentType !== undefined) updates.document_type = data.documentType;
            if (data.documentId !== undefined) updates.document_id = data.documentId;
            if (data.email !== undefined) updates.email = data.email;
            if (data.phone !== undefined) updates.phone = data.phone;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.country !== undefined) updates.country = data.country;
            if (data.hasVehicle !== undefined) updates.has_vehicle = data.hasVehicle;
            if (data.vehicleDescription !== undefined) updates.vehicle_description = data.vehicleDescription;
            if (data.licensePlate !== undefined) updates.license_plate = data.licensePlate;
            if (data.hasCurrentAccount !== undefined) updates.has_current_account = data.hasCurrentAccount;
            if (data.rating !== undefined) updates.rating = data.rating;
            if (data.ratingNotes !== undefined) updates.rating_notes = data.ratingNotes;
            if (data.ratingBy !== undefined) updates.rating_by = data.ratingBy;
            if (data.ratingAt !== undefined) updates.rating_at = data.ratingAt ? data.ratingAt.toISOString() : null;

            const { error } = await supabase
                .from('guests')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['guests'] });
            logAuditEvent({
                entityType: 'guest',
                entityId: variables.id,
                action: 'UPDATE',
                // Calificar es una opinión sobre una persona: en el log tiene que
                // leerse qué se puso, no un "actualizado" que no dice nada.
                description: variables.data.rating !== undefined
                    ? (variables.data.rating
                        ? `Calificación: ${GUEST_RATING_LABELS[variables.data.rating] || variables.data.rating}`
                        : 'Calificación quitada')
                    : 'Huésped actualizado',
                newValues: variables.data,
            });
        }
    });
};
