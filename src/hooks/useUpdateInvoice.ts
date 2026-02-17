import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

interface UpdateInvoiceParams {
    id: string;
    data: Partial<{
        status: InvoiceStatus;
        notes: string;
        signatureData: string;
        dueDate: Date;
    }>;
}

export const useUpdateInvoice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdateInvoiceParams) => {
            const updates: any = {};

            if (data.status !== undefined) updates.status = data.status;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.signatureData !== undefined) updates.signature_data = data.signatureData;
            if (data.dueDate !== undefined) updates.due_date = data.dueDate.toISOString().split('T')[0];

            const { error } = await supabase
                .from('invoices')
                .update(updates)
                .eq('id', id);

            if (error) {
                console.error('Error updating invoice:', error);
                throw error;
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

            // Audit log
            logAuditEvent({
                entityType: 'invoice',
                entityId: variables.id,
                action: variables.data.status ? 'STATUS_CHANGE' : 'UPDATE',
                description: variables.data.status
                    ? `Factura actualizada: estado → ${variables.data.status}`
                    : 'Factura actualizada',
                newValues: variables.data,
            });

            if (variables.data.status) {
                const typeMap: Record<string, { type: 'success' | 'info' | 'warning'; title: string }> = {
                    SENT: { type: 'info', title: 'Factura enviada' },
                    PAID: { type: 'success', title: 'Factura pagada' },
                    OVERDUE: { type: 'warning', title: 'Factura vencida' },
                    CANCELLED: { type: 'warning', title: 'Factura anulada' },
                };
                const info = typeMap[variables.data.status];
                if (info) {
                    createNotificationIfEnabled({
                        type: info.type,
                        category: 'payment',
                        title: info.title,
                        message: `Factura ${variables.id.slice(0, 8)} → ${variables.data.status}`,
                        metadata: { invoiceId: variables.id, status: variables.data.status },
                    });
                }
            }
        },
    });
};
