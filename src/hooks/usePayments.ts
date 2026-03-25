import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapPayment } from '@/lib/mappers';

export const usePayments = () => {
    return useQuery({
        queryKey: ['payments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            return (data || []).map(mapPayment);
        },
        staleTime: 2 * 60 * 1000,
    });
};
