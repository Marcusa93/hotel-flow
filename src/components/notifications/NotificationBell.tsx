import { useState } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotifications, useUnreadCount, Notification, NotificationCategory } from '@/hooks/useNotifications';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useMarkNotificationRead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    CalendarCheck,
    CreditCard,
    Sparkles,
    AlertTriangle,
    Info,
    LogIn,
    LogOut,
    Brush
} from 'lucide-react';

const categoryIcons: Record<NotificationCategory, React.ReactNode> = {
    booking: <CalendarCheck className="w-4 h-4" />,
    payment: <CreditCard className="w-4 h-4" />,
    housekeeping: <Brush className="w-4 h-4" />,
    checkin: <LogIn className="w-4 h-4" />,
    checkout: <LogOut className="w-4 h-4" />,
    promotion: <Sparkles className="w-4 h-4" />,
    system: <AlertTriangle className="w-4 h-4" />,
};

const categoryColors: Record<NotificationCategory, string> = {
    booking: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    payment: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    housekeeping: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    checkin: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    checkout: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    promotion: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    system: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const { data: notifications = [], isLoading } = useNotifications({ limit: 10 });
    const { data: unreadCount = 0 } = useUnreadCount();
    const markReadMutation = useMarkNotificationRead();
    const markAllReadMutation = useMarkAllNotificationsRead();

    const handleMarkRead = (id: string) => {
        markReadMutation.mutate(id);
    };

    const handleMarkAllRead = () => {
        markAllReadMutation.mutate();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-white/10"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <Badge
                                className="relative h-5 min-w-[20px] px-1 text-[10px] bg-rose-500 hover:bg-rose-500 border-0"
                            >
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-96 p-0"
                align="end"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold">Notificaciones</h4>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {unreadCount} nuevas
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={handleMarkAllRead}
                        >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Marcar todas
                        </Button>
                    )}
                </div>

                {/* Notifications List */}
                <ScrollArea className="h-[400px]">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Cargando...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                No hay notificaciones
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={handleMarkRead}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="p-3 border-t bg-muted/30">
                    <Link
                        to="/notifications"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                    >
                        Ver todas las notificaciones
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface NotificationItemProps {
    notification: Notification;
    onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
    return (
        <div
            className={cn(
                "p-4 hover:bg-muted/50 transition-colors cursor-pointer group",
                !notification.isRead && "bg-primary/5"
            )}
            onClick={() => !notification.isRead && onMarkRead(notification.id)}
        >
            <div className="flex gap-3">
                {/* Icon */}
                <div className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
                    categoryColors[notification.category]
                )}>
                    {categoryIcons[notification.category]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                            "text-sm leading-tight",
                            !notification.isRead && "font-semibold"
                        )}>
                            {notification.title}
                        </p>
                        {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-2">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es })}
                    </p>
                </div>
            </div>
        </div>
    );
}
