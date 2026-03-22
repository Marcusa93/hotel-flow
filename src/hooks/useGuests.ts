
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapGuest } from '@/lib/mappers';

export const useGuests = () => {
    return useQuery({
        queryKey: ['guests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('guests')
                .select('*');

            if (error) throw error;

            return (data || []).map(mapGuest);
        },
        staleTime: 2 * 60 * 1000,
    });
};
