
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Payment } from '@/types/hotel';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { createNotificationIfEnabled } from './useCreateNotification';
import { logAuditEvent } from './useCreateAuditLog';

type CreatePaymentParams = Omit<Payment, 'id'>;

export const useCreatePayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (paymentData: CreatePaymentParams) => {
            const { data, error } = await supabase
                .from('payments')
                .insert({
                    booking_id: paymentData.bookingId,
                    amount: paymentData.amount,
                    method: paymentData.method,
                    status: paymentData.status,
                    date: paymentData.date instanceof Date
                        ? paymentData.date.toISOString()
                        : paymentData.date,
                    reference: paymentData.reference || null,
                    comment: paymentData.comment || null,
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating payment:', error);
                throw error;
            }

            return {
                id: data.id,
                bookingId: data.booking_id,
                amount: data.amount,
                method: data.method,
                status: data.status,
                date: new Date(data.date),
                reference: data.reference,
                comment: data.comment,
            } as Payment;
        },
        onSuccess: (payment) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['revenueStats'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // Create notification for new payment
            const methodLabel = PAYMENT_METHOD_LABELS[payment.method]?.toLowerCase() || payment.method;

            createNotificationIfEnabled({
                type: 'success',
                category: 'payment',
                title: '💰 Pago registrado',
                message: `Pago de $${payment.amount.toLocaleString('es-AR')} recibido por ${methodLabel}`,
                metadata: { paymentId: payment.id, bookingId: payment.bookingId },
                push: true,
            });

            // Audit log
            logAuditEvent({
                entityType: 'payment',
                entityId: payment.id,
                action: 'CREATE',
                description: `Pago registrado: $${payment.amount.toLocaleString('es-AR')} por ${methodLabel}`,
                newValues: { amount: payment.amount, method: payment.method, status: payment.status, bookingId: payment.bookingId },
            });
        }
    });
};
