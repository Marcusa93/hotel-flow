import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, BedDouble, ClipboardList, Settings, Sparkles, CreditCard, MoreHorizontal } from 'lucide-react';
import { useAppRole } from '@/context/AppRoleContext';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/hotel';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Receipt, Percent, Shield, Bell } from 'lucide-react';

interface TabItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    roles: UserRole[];
}

const tabs: TabItem[] = [
    { label: 'Inicio', href: '/', icon: LayoutDashboard, roles: ['admin', 'reception'] },
    { label: 'Reservas', href: '/bookings', icon: CalendarDays, roles: ['admin', 'reception'] },
    { label: 'Habitaciones', href: '/rooms', icon: BedDouble, roles: ['admin', 'reception', 'housekeeping'] },
    { label: 'Limpieza', href: '/housekeeping', icon: Sparkles, roles: ['admin', 'housekeeping'] },
    { label: 'Finanzas', href: '/payments', icon: CreditCard, roles: ['admin', 'reception', 'auditor'] },
];

export function MobileTabBar() {
    const location = useLocation();
    const { currentRole } = useAppRole();

    const visibleTabs = tabs.filter(t => t.roles.includes(currentRole)).slice(0, 5);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 safe-area-bottom">
            <div className="flex items-center justify-around h-14 px-1">
                {visibleTabs.map(tab => {
                    const isActive = location.pathname === tab.href ||
                        (tab.href !== '/' && location.pathname.startsWith(tab.href));
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.href}
                            to={tab.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors rounded-lg',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            )}
                        >
                            <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                            <span className={cn(
                                'text-[10px] font-medium',
                                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                            )}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
