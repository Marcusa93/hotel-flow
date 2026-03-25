import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NotificationType, NotificationCategory } from './useNotifications';

interface CreateNotificationParams {
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

export const useCreateNotification = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateNotificationParams) => {
            const { data, error } = await supabase
                .from('notifications')
                .insert({
                    type: params.type,
                    category: params.category,
                    title: params.title,
                    message: params.message,
                    metadata: params.metadata || {},
                    is_read: false,
                })
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
        .insert({
            type: params.type,
            category: params.category,
            title: params.title,
            message: params.message,
            metadata: params.metadata || {},
            is_read: false,
        });

    if (error) {
        console.error('Failed to create notification:', error);
    }
};
