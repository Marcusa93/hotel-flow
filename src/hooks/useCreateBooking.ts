
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types/hotel';
import { createNotificationIfEnabled } from './useCreateNotification';
import { logAuditEvent } from './useCreateAuditLog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatLocalDate } from '@/lib/utils';

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
                    check_in_date: formatLocalDate(bookingData.checkInDate),
                    check_out_date: formatLocalDate(bookingData.checkOutDate),
                    adults: bookingData.adults,
                    children: bookingData.children,
                    status: bookingData.status,
                    total_amount: bookingData.totalAmount,
                    notes: bookingData.notes,
                    receptionist: bookingData.receptionist,
                    has_vehicle: bookingData.hasVehicle ?? false,
                    vehicle_description: bookingData.vehicleDescription,
                    license_plate: bookingData.licensePlate,
                    needs_review: bookingData.needsReview ?? false,
                })
                .select()
                .single();

            if (error) throw error;

            // Map back to CamelCase for the UI
            return {
                id: data.id,
                guestId: data.guest_id,
                roomId: data.room_id,
                checkInDate: new Date(data.check_in_date + 'T00:00:00'),
                checkOutDate: new Date(data.check_out_date + 'T00:00:00'),
                adults: data.adults,
                children: data.children,
                status: data.status,
                totalAmount: data.total_amount,
                notes: data.notes,
                receptionist: data.receptionist,
                hasVehicle: data.has_vehicle ?? false,
                vehicleDescription: data.vehicle_description,
                licensePlate: data.license_plate,
                needsReview: data.needs_review ?? false,
                createdAt: new Date(data.created_at)
            } as Booking;
        },
        onSuccess: (booking) => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Availability changes
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // Create notification for new booking
            createNotificationIfEnabled({
                type: 'success',
                category: 'booking',
                title: '📅 Nueva reserva creada',
                message: `Reserva del ${format(booking.checkInDate, 'dd MMM', { locale: es })} al ${format(booking.checkOutDate, 'dd MMM', { locale: es })} - Total: $${booking.totalAmount.toLocaleString('es-AR')}`,
                metadata: { bookingId: booking.id },
                push: true,
            });

            // Audit log
            logAuditEvent({
                entityType: 'booking',
                entityId: booking.id,
                action: 'CREATE',
                description: `Reserva creada: ${format(booking.checkInDate, 'dd/MM', { locale: es })} - ${format(booking.checkOutDate, 'dd/MM', { locale: es })} por $${booking.totalAmount.toLocaleString('es-AR')}`,
                newValues: { guestId: booking.guestId, roomId: booking.roomId, status: booking.status, totalAmount: booking.totalAmount },
            });
        }
    });
};
