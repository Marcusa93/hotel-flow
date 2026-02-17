import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

export const useDeleteRate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('rates')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['rates'] });
            logAuditEvent({
                entityType: 'rate',
                entityId: id,
                action: 'DELETE',
                description: `Tarifa eliminada`,
            });
        },
    });
};
