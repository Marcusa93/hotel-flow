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
    /** If userId is not set, the notification is broadcast to these roles. Defaults to admin+reception. */
    targetRoles?: UserRole[];
}

const buildPayload = (params: CreateNotificationParams) => ({
    type: params.type,
    category: params.category,
    title: params.title,
    message: params.message,
    metadata: params.metadata || {},
    is_read: false,
    user_id: params.userId ?? null,
    target_roles: params.userId ? null : (params.targetRoles ?? ['admin', 'reception']),
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
