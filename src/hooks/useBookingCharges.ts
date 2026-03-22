import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBookingCharge } from '@/lib/mappers';

export const useBookingCharges = (bookingId: string | undefined) => {
    return useQuery({
        queryKey: ['bookingCharges', bookingId],
        queryFn: async () => {
            if (!bookingId) return [];
            const { data, error } = await supabase
                .from('booking_charges')
                .select('*')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(mapBookingCharge);
        },
        enabled: !!bookingId,
    });
};
