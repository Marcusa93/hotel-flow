import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus } from '@/types/hotel';
import { formatLocalDate } from '@/lib/utils';
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
            const updates: Record<string, string | number | null> = {};

            if (data.status !== undefined) updates.status = data.status;
            if (data.notes !== undefined) updates.notes = data.notes;
            if (data.signatureData !== undefined) updates.signature_data = data.signatureData;
            if (data.dueDate !== undefined) updates.due_date = formatLocalDate(data.dueDate);

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
                // Keys must match InvoiceStatus ('DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED')
                const typeMap: Record<string, { type: 'success' | 'info' | 'warning'; title: string }> = {
                    ISSUED: { type: 'info', title: 'Factura emitida' },
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
