import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
                p_check_in: checkIn.toISOString().split('T')[0],
                p_check_out: checkOut.toISOString().split('T')[0],
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
