import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceItem, InvoiceItemType } from '@/types/hotel';
import { formatLocalDate } from '@/lib/utils';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

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

            // Calculate totals (round to cents — money must not carry float dust)
            const round2 = (n: number) => Math.round(n * 100) / 100;
            const subtotal = round2(items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0));
            const taxAmount = round2(subtotal * (taxRate / 100));
            const total = round2(subtotal + taxAmount);

            // generate_invoice_number() is MAX()+1 without a lock, so two concurrent
            // creates can get the same number — retry on unique violation (23505)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let invoice: Record<string, any> | null = null;
            let lastError: unknown = null;
            for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
                const { data: numberData, error: numberError } = await supabase
                    .rpc('generate_invoice_number');

                if (numberError) {
                    console.error('Error generating invoice number:', numberError);
                    throw numberError;
                }

                const { data, error: invoiceError } = await supabase
                    .from('invoices')
                    .insert({
                        invoice_number: numberData,
                        booking_id: invoiceData.bookingId,
                        guest_id: invoiceData.guestId,
                        due_date: invoiceData.dueDate ? formatLocalDate(invoiceData.dueDate) : undefined,
                        status: 'DRAFT',
                        subtotal,
                        tax_rate: taxRate,
                        tax_amount: taxAmount,
                        total,
                        notes: invoiceData.notes,
                    })
                    .select()
                    .single();

                if (data) {
                    invoice = data;
                } else {
                    lastError = invoiceError;
                    if (invoiceError?.code !== '23505') break;
                }
            }

            if (!invoice) {
                console.error('Error creating invoice:', lastError);
                throw lastError;
            }

            // Insert items
            const itemsToInsert = items.map(item => ({
                invoice_id: invoice.id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total: round2(item.quantity * item.unitPrice),
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
        onSuccess: (invoice) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });

            // Audit log
            logAuditEvent({
                entityType: 'invoice',
                entityId: invoice.id,
                action: 'CREATE',
                description: `Factura ${invoice.invoiceNumber} creada por $${invoice.total.toLocaleString('es-AR')}`,
                newValues: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, status: 'DRAFT' },
            });

            createNotificationIfEnabled({
                type: 'success',
                category: 'payment',
                title: 'Factura generada',
                message: `Factura ${invoice.invoiceNumber} creada por $${invoice.total.toLocaleString('es-AR')}`,
                metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total: invoice.total },
            });
        },
    });
};
