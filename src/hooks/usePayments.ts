import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Payment } from '@/types/hotel';

export const usePayments = () => {
    return useQuery({
        queryKey: ['payments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching payments:', error);
                throw error;
            }

            return data.map((payment: Record<string, unknown>) => ({
                id: payment.id,
                bookingId: payment.booking_id,
                amount: Number(payment.amount),
                method: payment.method,
                status: payment.status,
                date: new Date(payment.date),
                reference: payment.reference,
                comment: payment.comment,
            } as Payment));
        },
    });
};
