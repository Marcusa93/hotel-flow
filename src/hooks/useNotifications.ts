import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'booking' | 'payment' | 'housekeeping' | 'checkin' | 'checkout' | 'promotion' | 'system';

export interface Notification {
    id: string;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    isRead: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
}

interface UseNotificationsOptions {
    unreadOnly?: boolean;
    category?: NotificationCategory;
    limit?: number;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
    const queryClient = useQueryClient();
    const { unreadOnly = false, category, limit = 50 } = options;

    const query = useQuery({
        queryKey: ['notifications', { unreadOnly, category, limit }],
        queryFn: async () => {
            let query = supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (unreadOnly) {
                query = query.eq('is_read', false);
            }

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map(n => ({
                id: n.id,
                type: n.type as NotificationType,
                category: n.category as NotificationCategory,
                title: n.title,
                message: n.message,
                isRead: n.is_read,
                metadata: n.metadata || {},
                createdAt: new Date(n.created_at),
            })) as Notification[];
        },
    });

    // Real-time subscription for new notifications
    useEffect(() => {
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return query;
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: ['notifications', 'unreadCount'],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false);

            if (error) throw error;
            return count || 0;
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });
};
