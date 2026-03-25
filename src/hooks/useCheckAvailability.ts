import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/utils';

interface CheckAvailabilityParams {
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    excludeBookingId?: string;
}

export const useCheckAvailability = () => {
    return useMutation({
        mutationFn: async ({ roomId, checkIn, checkOut, excludeBookingId }: CheckAvailabilityParams): Promise<boolean> => {
            const { data, error } = await supabase.rpc('check_room_availability', {
                p_room_id: roomId,
                p_check_in: formatLocalDate(checkIn),
                p_check_out: formatLocalDate(checkOut),
                p_exclude_booking_id: excludeBookingId || null
            });

            if (error) {
                console.error('Error checking availability:', error);
                throw error;
            }

            return data as boolean;
        }
    });
};
