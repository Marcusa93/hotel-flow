import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole, NotificationSettings } from '@/types/hotel';

interface AppRoleContextType {
  currentRole: UserRole;
  profileLoading: boolean;
  profileName: string | null;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

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
  const { user } = useAuth();

  // Fetch profile from database — role is assigned by admin
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // If no profile found, fall back to user_metadata
        if (error.code === 'PGRST116') {
          return {
            role: (user.user_metadata?.role as UserRole) || 'reception',
            fullName: (user.user_metadata?.full_name as string) || null,
          };
        }
        console.warn('Error fetching profile:', error.message);
        return null;
      }

      return {
        role: data.role as UserRole,
        fullName: data.full_name as string | null,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Role comes from the database profile — no more localStorage simulation
  const currentRole: UserRole = profile?.role ?? 'reception';
  const profileName: string | null = profile?.fullName ?? null;

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (saved) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { console.warn('Failed to parse notification settings:', e); }
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
        profileLoading,
        profileName,
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
  } catch (e) { console.warn('Failed to read notification settings:', e); }
  return DEFAULT_NOTIF_SETTINGS;
}
