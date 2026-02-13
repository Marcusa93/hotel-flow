import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

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
        },
    });
};
