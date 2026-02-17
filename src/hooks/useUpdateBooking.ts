
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BookingStatus } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

interface UpdateBookingStatusParams {
    id: string;
    status: BookingStatus;
}

export const useUpdateBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: UpdateBookingStatusParams) => {
            const { data, error } = await supabase
                .from('bookings')
                .update({ status })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Rooms might change status on check-in

            // Audit log
            logAuditEvent({
                entityType: 'booking',
                entityId: variables.id,
                action: 'STATUS_CHANGE',
                description: `Estado de reserva cambiado a ${variables.status}`,
                newValues: { status: variables.status },
            });

            // Notifications
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
    });
};
