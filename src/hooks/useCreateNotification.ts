import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NotificationType, NotificationCategory } from './useNotifications';
import { getNotificationSettings } from '@/context/AppRoleContext';

interface CreateNotificationParams {
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    metadata?: Record<string, any>;
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
 * Map a NotificationCategory to the corresponding setting key in NotificationSettings.
 * Returns null if the category has no toggle (always allowed).
 */
const categoryToSettingKey: Partial<Record<NotificationCategory, keyof ReturnType<typeof getNotificationSettings>>> = {
    booking: 'sendOnBooking',
    payment: 'sendOnPayment',
    checkin: 'sendOnCheckIn',
    checkout: 'sendOnCheckOut',
};

/**
 * Check if a notification should be created based on user preferences.
 * Categories without an explicit toggle (housekeeping, promotion, system) are always allowed.
 */
function isNotificationEnabled(category: NotificationCategory): boolean {
    const settings = getNotificationSettings();
    const key = categoryToSettingKey[category];
    if (!key) return true; // housekeeping, promotion, system — always enabled
    return settings[key] as boolean;
}

/**
 * Create a notification only if the user's settings allow it for that category.
 * This is the function all hooks should call instead of `createNotification`.
 */
export const createNotificationIfEnabled = async (params: CreateNotificationParams) => {
    if (!isNotificationEnabled(params.category)) {
        return; // Silently skip — user disabled this category
    }

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

// Legacy helper — creates notification unconditionally (kept for manual/test sends)
export const createNotification = async (params: CreateNotificationParams) => {
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
