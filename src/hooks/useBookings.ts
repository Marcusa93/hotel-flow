
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBooking } from '@/lib/mappers';

export const useBookings = () => {
    return useQuery({
        queryKey: ['bookings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*');

            if (error) throw error;

            return (data || []).map(mapBooking);
        },
        staleTime: 2 * 60 * 1000,
    });
};
