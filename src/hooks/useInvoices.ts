import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceItem } from '@/types/hotel';

export const useInvoices = () => {
    return useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            // Fetch invoices with their items
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('invoices')
                .select('*')
                .order('issue_date', { ascending: false });

            if (invoicesError) {
                console.error('Error fetching invoices:', invoicesError);
                throw invoicesError;
            }

            // Fetch all invoice items
            const { data: itemsData, error: itemsError } = await supabase
                .from('invoice_items')
                .select('*');

            if (itemsError) {
                console.error('Error fetching invoice items:', itemsError);
                throw itemsError;
            }

            // Map and combine data
            return invoicesData.map((inv: any) => ({
                id: inv.id,
                invoiceNumber: inv.invoice_number,
                bookingId: inv.booking_id,
                guestId: inv.guest_id,
                issueDate: new Date(inv.issue_date),
                dueDate: inv.due_date ? new Date(inv.due_date) : undefined,
                status: inv.status,
                subtotal: Number(inv.subtotal),
                taxRate: Number(inv.tax_rate),
                taxAmount: Number(inv.tax_amount),
                total: Number(inv.total),
                notes: inv.notes,
                signatureData: inv.signature_data,
                items: itemsData
                    .filter((item: any) => item.invoice_id === inv.id)
                    .map((item: any) => ({
                        id: item.id,
                        invoiceId: item.invoice_id,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: Number(item.unit_price),
                        total: Number(item.total),
                        itemType: item.item_type,
                    } as InvoiceItem)),
            } as Invoice));
        },
    });
};
