import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const categoryEmojis: Record<string, string> = {
  booking: '📅',
  payment: '💳',
  housekeeping: '🧹',
  checkin: '✅',
  checkout: '🚪',
  promotion: '🎉',
  system: '⚙️',
};

/**
 * Hook that listens for new notifications via Supabase Realtime
 * and shows a toast popup for each new INSERT.
 * Mount this once in MainLayout.
 */
export function useNotificationToast() {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const channel = supabase
      .channel('notification-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (!mountedRef.current) return;

          const newNotif = payload.new as {
            title?: string;
            message?: string;
            category?: string;
            type?: string;
            metadata?: { autoAlert?: boolean };
          };

          // Skip toast for auto-generated proactive alerts (they send push notifications instead)
          if (newNotif?.title && !newNotif.metadata?.autoAlert) {
            const emoji = categoryEmojis[newNotif.category || 'system'] || '🔔';

            toast({
              title: `${emoji} ${newNotif.title}`,
              description: newNotif.message,
              variant: newNotif.type === 'error' ? 'destructive' : undefined,
            });
          }

          // Also invalidate notification queries so counts update
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
