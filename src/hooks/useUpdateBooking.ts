
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

interface UpdateBookingParams {
    id: string;
    status?: BookingStatus;
    checkInDate?: string;
    checkOutDate?: string;
    roomId?: string;
    adults?: number;
    children?: number;
    notes?: string;
    totalAmount?: number;
}

export const useUpdateBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...fields }: UpdateBookingParams) => {
            // Build partial update object from all non-undefined fields
            const updateData: Record<string, unknown> = {};

            if (fields.status !== undefined) updateData.status = fields.status;
            if (fields.checkInDate !== undefined) updateData.checkInDate = fields.checkInDate;
            if (fields.checkOutDate !== undefined) updateData.checkOutDate = fields.checkOutDate;
            if (fields.roomId !== undefined) updateData.roomId = fields.roomId;
            if (fields.adults !== undefined) updateData.adults = fields.adults;
            if (fields.children !== undefined) updateData.children = fields.children;
            if (fields.notes !== undefined) updateData.notes = fields.notes;
            if (fields.totalAmount !== undefined) updateData.totalAmount = fields.totalAmount;

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
                const statusLabels: Record<string, { title: string; category: 'checkin' | 'checkout' | 'booking'; type: 'success' | 'info' | 'warning' }> = {
                    CHECKED_IN: { title: 'Check-in realizado', category: 'checkin', type: 'success' },
                    CHECKED_OUT: { title: 'Check-out realizado', category: 'checkout', type: 'info' },
                    CANCELLED: { title: 'Reserva cancelada', category: 'booking', type: 'warning' },
                    NO_SHOW: { title: 'No-show registrado', category: 'booking', type: 'warning' },
                };
                const statusInfo = statusLabels[variables.status];
                if (statusInfo) {
                    createNotificationIfEnabled({
                        type: statusInfo.type,
                        category: statusInfo.category,
                        title: statusInfo.title,
                        message: `Reserva ${variables.id.slice(0, 8)} → ${variables.status}`,
                        metadata: { bookingId: variables.id, status: variables.status },
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
