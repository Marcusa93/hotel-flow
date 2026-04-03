import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { AtlasChatbot } from '@/components/chat/AtlasChatbot';
import { useNotificationToast } from '@/hooks/useNotificationToast';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  useNotificationToast();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50/50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6 scrollbar-thin">
          {children}
        </main>
        <AtlasChatbot />
        <MobileTabBar />
      </div>
    </div>
  );
}
