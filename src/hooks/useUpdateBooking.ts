
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingStatus, Room, Guest } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import { formatLocalDate } from '@/lib/utils';

interface UpdateBookingParams {
    id: string;
    status?: BookingStatus;
    checkInDate?: string | Date;
    checkOutDate?: string | Date;
    roomId?: string;
    adults?: number;
    children?: number;
    notes?: string;
    totalAmount?: number;
    hasVehicle?: boolean;
    vehicleDescription?: string;
    licensePlate?: string;
    needsReview?: boolean;
}

/**
 * Describe la reserva para el cuerpo de la notificación.
 *
 * Estos mensajes ahora viajan al teléfono: "Reserva a1b2c3d4 → CHECKED_IN" no le
 * dice nada a nadie en una pantalla bloqueada. Huésped y habitación salen de la
 * caché de react-query, que ya los tiene cargados — sin round-trip extra. Si
 * falta alguno, se degrada a lo que haya antes que al id crudo.
 */
const describeBooking = (
    queryClient: QueryClient,
    booking: { room_id?: string; guest_id?: string } | null,
    bookingId: string
): string => {
    const room = booking?.room_id
        ? queryClient.getQueryData<Room[]>(['rooms'])?.find(r => r.id === booking.room_id)
        : undefined;
    const guest = booking?.guest_id
        ? queryClient.getQueryData<Guest[]>(['guests'])?.find(g => g.id === booking.guest_id)
        : undefined;

    const parts = [
        guest?.fullName,
        room?.roomNumber ? `Habitación ${room.roomNumber}` : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' — ') : `Reserva ${bookingId.slice(0, 8)}`;
};

export const useUpdateBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...fields }: UpdateBookingParams) => {
            // Build partial update object from all non-undefined fields
            const updateData: Record<string, unknown> = {};

            if (fields.status !== undefined) updateData.status = fields.status;
            if (fields.checkInDate !== undefined) updateData.check_in_date = fields.checkInDate instanceof Date ? formatLocalDate(fields.checkInDate) : fields.checkInDate;
            if (fields.checkOutDate !== undefined) updateData.check_out_date = fields.checkOutDate instanceof Date ? formatLocalDate(fields.checkOutDate) : fields.checkOutDate;
            if (fields.roomId !== undefined) updateData.room_id = fields.roomId;
            if (fields.adults !== undefined) updateData.adults = fields.adults;
            if (fields.children !== undefined) updateData.children = fields.children;
            if (fields.notes !== undefined) updateData.notes = fields.notes;
            if (fields.totalAmount !== undefined) updateData.total_amount = fields.totalAmount;
            if (fields.hasVehicle !== undefined) updateData.has_vehicle = fields.hasVehicle;
            if (fields.vehicleDescription !== undefined) updateData.vehicle_description = fields.vehicleDescription;
            if (fields.licensePlate !== undefined) updateData.license_plate = fields.licensePlate;
            if (fields.needsReview !== undefined) updateData.needs_review = fields.needsReview;

            const { data, error } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Rooms might change status on check-in

            // Determine audit description
            const changedFields = Object.keys(variables).filter(k => k !== 'id' && variables[k as keyof UpdateBookingParams] !== undefined);
            const isStatusOnly = changedFields.length === 1 && changedFields[0] === 'status';

            // Audit log
            logAuditEvent({
                entityType: 'booking',
                entityId: variables.id,
                action: isStatusOnly ? 'STATUS_CHANGE' : 'UPDATE',
                description: isStatusOnly
                    ? `Estado de reserva cambiado a ${variables.status}`
                    : `Reserva actualizada: ${changedFields.join(', ')}`,
                newValues: Object.fromEntries(
                    changedFields.map(k => [k, variables[k as keyof UpdateBookingParams]])
                ),
            });

            // Notifications for status changes
            if (variables.status) {
                const statusLabels: Record<string, { title: string; category: 'checkin' | 'checkout' | 'booking'; type: 'success' | 'info' | 'warning'; push: boolean }> = {
                    CHECKED_IN: { title: 'Check-in realizado', category: 'checkin', type: 'success', push: true },
                    CHECKED_OUT: { title: 'Check-out realizado', category: 'checkout', type: 'info', push: true },
                    CANCELLED: { title: 'Reserva cancelada', category: 'booking', type: 'warning', push: false },
                    NO_SHOW: { title: 'No-show registrado', category: 'booking', type: 'warning', push: false },
                };
                const statusInfo = statusLabels[variables.status];
                if (statusInfo) {
                    createNotificationIfEnabled({
                        type: statusInfo.type,
                        category: statusInfo.category,
                        title: statusInfo.title,
                        message: describeBooking(queryClient, data, variables.id),
                        metadata: { bookingId: variables.id, status: variables.status },
                        push: statusInfo.push,
                    });
                }
            }

            // Notification for booking edits (non-status changes)
            if (!isStatusOnly) {
                createNotificationIfEnabled({
                    type: 'info',
                    category: 'booking',
                    title: 'Reserva modificada',
                    message: `Reserva ${variables.id.slice(0, 8)} actualizada`,
                    metadata: { bookingId: variables.id },
                });
            }
        }
    });
};
