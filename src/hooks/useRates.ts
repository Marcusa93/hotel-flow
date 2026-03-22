import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapRate } from '@/lib/mappers';

export const useRates = () => {
    return useQuery({
        queryKey: ['rates'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rates')
                .select('*')
                .order('start_date', { ascending: true });

            if (error) throw error;

            return (data || []).map(mapRate);
        },
        staleTime: 5 * 60 * 1000,
    });
};
