import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus } from '@/types/hotel';

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        },
    });
};
