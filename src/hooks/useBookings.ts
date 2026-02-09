
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types/hotel';

export const useBookings = () => {
    return useQuery({
        queryKey: ['bookings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*');

            if (error) throw error;

            return data.map((item: any) => ({
                id: item.id,
                guestId: item.guest_id,
                roomId: item.room_id,
                checkInDate: new Date(item.check_in_date),
                checkOutDate: new Date(item.check_out_date),
                adults: item.adults,
                children: item.children,
                status: item.status,
                totalAmount: item.total_amount,
                notes: item.notes,
                createdAt: new Date(item.created_at || new Date())
            })) as Booking[];
        }
    });
};
