
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Payment } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

interface UpdatePaymentParams {
    id: string;
    data: Partial<Payment>;
}

export const useUpdatePayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdatePaymentParams) => {
            // Map camelCase to snake_case for DB
            const updates: any = {};
            if (data.amount !== undefined) updates.amount = data.amount;
            if (data.method !== undefined) updates.method = data.method;
            if (data.status !== undefined) updates.status = data.status;
            if (data.date !== undefined) updates.date = data.date.toISOString();

            const { error } = await supabase
                .from('payments')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

            // Audit log
            logAuditEvent({
                entityType: 'payment',
                entityId: variables.id,
                action: 'UPDATE',
                description: `Pago actualizado${variables.data.status ? `: estado → ${variables.data.status}` : ''}`,
                newValues: variables.data,
            });

            if (variables.data.status) {
                const typeMap: Record<string, { type: 'success' | 'warning' | 'error'; title: string }> = {
                    COMPLETED: { type: 'success', title: 'Pago completado' },
                    REFUNDED: { type: 'warning', title: 'Pago reembolsado' },
                    CANCELLED: { type: 'error', title: 'Pago cancelado' },
                };
                const info = typeMap[variables.data.status];
                if (info) {
                    createNotificationIfEnabled({
                        type: info.type,
                        category: 'payment',
                        title: info.title,
                        message: `Pago ${variables.id.slice(0, 8)} → ${variables.data.status}`,
                        metadata: { paymentId: variables.id, status: variables.data.status },
                    });
                }
            }
        }
    });
};
