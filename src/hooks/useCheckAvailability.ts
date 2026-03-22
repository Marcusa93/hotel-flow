import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface CheckAvailabilityParams {
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    excludeBookingId?: string;
}

/** Format a Date as YYYY-MM-DD in the local timezone (not UTC) */
function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
