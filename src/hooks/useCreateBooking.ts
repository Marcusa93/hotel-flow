
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types/hotel';
import { createNotification } from './useCreateNotification';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CreateBookingParams = Omit<Booking, 'id' | 'createdAt'>;

export const useCreateBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (bookingData: CreateBookingParams) => {
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    guest_id: bookingData.guestId,
                    room_id: bookingData.roomId,
                    check_in_date: bookingData.checkInDate.toISOString(),
                    check_out_date: bookingData.checkOutDate.toISOString(),
                    adults: bookingData.adults,
                    children: bookingData.children,
                    status: bookingData.status,
                    total_amount: bookingData.totalAmount,
                    notes: bookingData.notes
                })
                .select()
                .single();

            if (error) throw error;

            // Map back to CamelCase for the UI
            return {
                id: data.id,
                guestId: data.guest_id,
                roomId: data.room_id,
                checkInDate: new Date(data.check_in_date),
                checkOutDate: new Date(data.check_out_date),
                adults: data.adults,
                children: data.children,
                status: data.status,
                totalAmount: data.total_amount,
                notes: data.notes,
                createdAt: new Date(data.created_at)
            } as Booking;
        },
        onSuccess: (booking) => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Availability changes
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // Create notification for new booking
            createNotification({
                type: 'success',
                category: 'booking',
                title: '📅 Nueva reserva creada',
                message: `Reserva del ${format(booking.checkInDate, 'dd MMM', { locale: es })} al ${format(booking.checkOutDate, 'dd MMM', { locale: es })} - Total: $${booking.totalAmount.toLocaleString('es-AR')}`,
                metadata: { bookingId: booking.id }
            });
        }
    });
};
