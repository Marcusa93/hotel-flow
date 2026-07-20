import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NotificationType, NotificationCategory } from './useNotifications';
import type { UserRole } from '@/types/hotel';

interface CreateNotificationParams {
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    /** If set, notification is personal (only this user sees it). */
    userId?: string;
    /** If userId is not set, broadcast to these roles. Defaults by category. */
    targetRoles?: UserRole[];
}

/**
 * Who needs to act on each kind of notification.
 *
 * Everything used to default to admin+reception, which meant a "Habitación 203
 * requiere limpieza" notice reached everyone except the people who clean.
 */
const CATEGORY_TARGETS: Record<NotificationCategory, UserRole[]> = {
    housekeeping: ['admin', 'housekeeping'],
    booking: ['admin', 'reception'],
    payment: ['admin', 'reception'],
    checkin: ['admin', 'reception'],
    checkout: ['admin', 'reception'],
    promotion: ['admin', 'reception'],
    system: ['admin', 'reception'],
};

export const targetRolesForCategory = (category: NotificationCategory): UserRole[] =>
    CATEGORY_TARGETS[category] ?? ['admin', 'reception'];

const buildPayload = (params: CreateNotificationParams) => ({
    type: params.type,
    category: params.category,
    title: params.title,
    message: params.message,
    metadata: params.metadata || {},
    is_read: false,
    user_id: params.userId ?? null,
    target_roles: params.userId ? null : (params.targetRoles ?? targetRolesForCategory(params.category)),
});

export const useCreateNotification = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateNotificationParams) => {
            const { data, error } = await supabase
                .from('notifications')
                .insert(buildPayload(params))
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

/**
 * Create an in-app notification. Always creates — no external email/whatsapp sending.
 */
export const createNotificationIfEnabled = async (params: CreateNotificationParams) => {
    const { error } = await supabase
        .from('notifications')
        .insert(buildPayload(params));

    if (error) {
        console.error('Failed to create notification:', error);
    }
};
