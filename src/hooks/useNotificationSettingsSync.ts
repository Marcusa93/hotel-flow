import { useEffect } from 'react';
import { useHotelSettings } from './useHotelSettings';
import { useAppRole } from '@/context/AppRoleContext';

/**
 * Syncs notification settings from Supabase hotel_settings → AppRoleContext + localStorage.
 * Should be called once at app root (e.g., Layout component).
 */
export function useNotificationSettingsSync() {
  const { data: settings } = useHotelSettings();
  const { updateNotificationSettings } = useAppRole();

  useEffect(() => {
    if (settings) {
      updateNotificationSettings({
        emailEnabled: settings.notificationEmailEnabled,
        whatsappEnabled: settings.notificationWhatsappEnabled,
        sendOnBooking: settings.notificationSendOnBooking,
        sendOnPayment: settings.notificationSendOnPayment,
        sendOnCheckIn: settings.notificationSendOnCheckIn,
        sendOnCheckOut: settings.notificationSendOnCheckOut,
      });
    }
  }, [settings, updateNotificationSettings]);
}
