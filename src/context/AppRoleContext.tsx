import React, { createContext, useContext, useState, useCallback } from 'react';
import type { UserRole, NotificationSettings } from '@/types/hotel';

interface AppRoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

export function AppRoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    whatsappEnabled: false,
    sendOnBooking: true,
    sendOnPayment: true,
    sendOnCheckIn: true,
    sendOnCheckOut: false,
  });

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
