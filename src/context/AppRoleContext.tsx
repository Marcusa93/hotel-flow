import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserRole, NotificationSettings } from '@/types/hotel';

interface AppRoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

const ROLE_STORAGE_KEY = 'home_app_role';
const NOTIF_STORAGE_KEY = 'home_notification_settings';

const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  whatsappEnabled: false,
  sendOnBooking: true,
  sendOnPayment: true,
  sendOnCheckIn: true,
  sendOnCheckOut: false,
};

export function AppRoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(ROLE_STORAGE_KEY);
    return (saved as UserRole) || 'admin';
  });

  const setCurrentRole = useCallback((role: UserRole) => {
    setCurrentRoleState(role);
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }, []);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (saved) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(saved) };
    } catch { /* ignore parse errors */ }
    return DEFAULT_NOTIF_SETTINGS;
  });

  // Persist notification settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  const updateNotificationSettings = useCallback(
    (settings: Partial<NotificationSettings>) => {
      setNotificationSettings((prev) => ({ ...prev, ...settings }));
    },
    []
  );

  return (
    <AppRoleContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        notificationSettings,
        updateNotificationSettings,
      }}
    >
      {children}
    </AppRoleContext.Provider>
  );
}

export function useAppRole() {
  const context = useContext(AppRoleContext);
  if (context === undefined) {
    throw new Error('useAppRole must be used within an AppRoleProvider');
  }
  return context;
}

/**
 * Read notification settings from localStorage (for use outside React components).
 * Falls back to defaults if nothing is saved.
 */
export function getNotificationSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (saved) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_NOTIF_SETTINGS;
}
