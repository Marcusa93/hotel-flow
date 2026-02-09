import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceItem, InvoiceItemType } from '@/types/hotel';

interface CreateInvoiceParams {
    bookingId: string;
    guestId: string;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        itemType: InvoiceItemType;
    }>;
    taxRate?: number;
    notes?: string;
    dueDate?: Date;
}

export const useCreateInvoice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateInvoiceParams) => {
            const { items, taxRate = 21, ...invoiceData } = params;

            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
            const taxAmount = subtotal * (taxRate / 100);
            const total = subtotal + taxAmount;

            // Generate invoice number using DB function
            const { data: numberData, error: numberError } = await supabase
                .rpc('generate_invoice_number');

            if (numberError) {
                console.error('Error generating invoice number:', numberError);
                throw numberError;
            }

            // Insert invoice
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    invoice_number: numberData,
                    booking_id: invoiceData.bookingId,
                    guest_id: invoiceData.guestId,
                    due_date: invoiceData.dueDate?.toISOString().split('T')[0],
                    status: 'DRAFT',
                    subtotal,
                    tax_rate: taxRate,
                    tax_amount: taxAmount,
                    total,
                    notes: invoiceData.notes,
                })
                .select()
                .single();

            if (invoiceError) {
                console.error('Error creating invoice:', invoiceError);
                throw invoiceError;
            }

            // Insert items
            const itemsToInsert = items.map(item => ({
                invoice_id: invoice.id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total: item.quantity * item.unitPrice,
                item_type: item.itemType,
            }));

            const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(itemsToInsert);

            if (itemsError) {
                console.error('Error creating invoice items:', itemsError);
                // Rollback invoice
                await supabase.from('invoices').delete().eq('id', invoice.id);
                throw itemsError;
            }

            return {
                id: invoice.id,
                invoiceNumber: invoice.invoice_number,
                bookingId: invoice.booking_id,
                guestId: invoice.guest_id,
                issueDate: new Date(invoice.issue_date),
                dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
                status: invoice.status,
                subtotal: Number(invoice.subtotal),
                taxRate: Number(invoice.tax_rate),
                taxAmount: Number(invoice.tax_amount),
                total: Number(invoice.total),
                notes: invoice.notes,
                items: items.map((item, idx) => ({
                    id: '', // Will be set after refetch
                    invoiceId: invoice.id,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    itemType: item.itemType,
                })),
            } as Invoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        },
    });
};
