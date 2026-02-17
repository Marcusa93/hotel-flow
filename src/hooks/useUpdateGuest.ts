
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Guest } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

interface UpdateGuestParams {
    id: string;
    data: Partial<Guest>;
}

export const useUpdateGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdateGuestParams) => {
            const updates: Record<string, any> = {};

            if (data.fullName !== undefined) updates.full_name = data.fullName;
            if (data.documentId !== undefined) updates.document_id = data.documentId;
            if (data.email !== undefined) updates.email = data.email;
            if (data.phone !== undefined) updates.phone = data.phone;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.country !== undefined) updates.country = data.country;

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
                description: `Huésped actualizado`,
                newValues: variables.data,
            });
        }
    });
};
