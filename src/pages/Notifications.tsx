import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, Check, CheckCheck, Trash2, Filter, Bell, RefreshCw, ArrowRight } from 'lucide-react';
import { PageHeader, ListSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications, useUnreadCount, Notification, NotificationCategory } from '@/hooks/useNotifications';
import { useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, useClearAllNotifications } from '@/hooks/useMarkNotificationRead';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck,
  CreditCard,
  Sparkles,
  AlertTriangle,
  LogIn,
  LogOut,
  Brush
} from 'lucide-react';

const categoryIcons: Record<NotificationCategory, React.ReactNode> = {
  booking: <CalendarCheck className="w-5 h-5" />,
  payment: <CreditCard className="w-5 h-5" />,
  housekeeping: <Brush className="w-5 h-5" />,
  checkin: <LogIn className="w-5 h-5" />,
  checkout: <LogOut className="w-5 h-5" />,
  promotion: <Sparkles className="w-5 h-5" />,
  system: <AlertTriangle className="w-5 h-5" />,
};

const categoryLabels: Record<NotificationCategory, string> = {
  booking: 'Reservas',
  payment: 'Pagos',
  housekeeping: 'Limpieza',
  checkin: 'Check-in',
  checkout: 'Check-out',
  promotion: 'Promociones',
  system: 'Sistema',
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

export default function Notifications() {
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const { data: allNotifications = [], isLoading, refetch } = useNotifications({ limit: 100 });
  const { data: unreadCount = 0 } = useUnreadCount();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const deleteMutation = useDeleteNotification();
  const clearAllMutation = useClearAllNotifications();

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = allNotifications;

    if (tab === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(n => n.category === categoryFilter);
    }

    return filtered;
  }, [allNotifications, tab, categoryFilter]);

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: '✅ Todas marcadas como leídas' });
      }
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: '🗑️ Notificación eliminada' });
      }
    });
  };

  const handleClearAll = () => {
    clearAllMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: '🧹 Notificaciones leídas eliminadas' });
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Centro de Notificaciones"
        description="Gestión de alertas y comunicaciones del sistema"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Configuración
            </Button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{allNotifications.length}</p>
              </div>
              <Bell className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-none bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-rose-600 dark:text-rose-400">No leídas</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{unreadCount}</p>
              </div>
              <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hoy</p>
                <p className="text-2xl font-bold">
                  {allNotifications.filter(n => {
                    const today = new Date();
                    const created = new Date(n.createdAt);
                    return created.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
              <CalendarCheck className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categorías</p>
                <p className="text-2xl font-bold">
                  {new Set(allNotifications.map(n => n.category)).size}
                </p>
              </div>
              <Filter className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Notifications List */}
        <Card className="lg:col-span-2 glass border-none shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg">Historial de Notificaciones</CardTitle>
                <CardDescription>{filteredNotifications.length} notificaciones</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as NotificationCategory | 'all')}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Marcar todas
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="relative">
                  No leídas
                  {unreadCount > 0 && (
                    <Badge className="ml-2 h-5 px-1.5 text-xs bg-rose-500">{unreadCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <NotificationsList
                  notifications={filteredNotifications}
                  isLoading={isLoading}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              </TabsContent>
              <TabsContent value="unread" className="mt-0">
                <NotificationsList
                  notifications={filteredNotifications}
                  isLoading={isLoading}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-6">
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="text-base text-amber-900 dark:text-amber-100">Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start border-slate-200"
                onClick={handleClearAll}
                disabled={clearAllMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Limpiar leídas
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-0">
            <CardContent className="p-6">
              <h4 className="font-bold mb-2">💡 Consejo Pro</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Las notificaciones se actualizan en tiempo real. Los eventos importantes como nuevas reservas y pagos generarán alertas automáticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Resolve navigation route from notification category + metadata */
function getNotificationRoute(notification: Notification): string {
  const { category, metadata } = notification;
  if (metadata?.bookingId) return `/bookings/${metadata.bookingId}`;
  const categoryRoutes: Record<NotificationCategory, string> = {
    booking: '/bookings',
    payment: '/payments',
    housekeeping: '/housekeeping',
    checkin: '/bookings',
    checkout: '/bookings',
    promotion: '/notifications',
    system: '/audit-log',
  };
  return categoryRoutes[category] || '/notifications';
}

interface NotificationsListProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationsList({ notifications, isLoading, onMarkRead, onDelete }: NotificationsListProps) {
  const navigate = useNavigate();

  const handleNavigate = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    const route = getNotificationRoute(notification);
    navigate(route);
  };

  if (isLoading) {
    return <ListSkeleton items={5} showAvatar />;
  }

  if (notifications.length === 0) {
    return (
      <div className="p-12 text-center">
        <Bell className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
        <p className="text-muted-foreground">No hay notificaciones</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-2">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={cn(
                "p-4 rounded-xl border transition-all hover:shadow-md group cursor-pointer",
                !notification.isRead
                  ? "bg-primary/5 border-primary/20"
                  : "bg-background hover:bg-muted/50"
              )}
              onClick={() => handleNavigate(notification)}
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                  categoryColors[notification.category]
                )}>
                  {categoryIcons[notification.category]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "font-medium",
                        !notification.isRead && "text-primary"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[notification.category]}
                    </Badge>
                    {notification.metadata?.amount && (
                      <Badge variant="secondary" className="text-xs">
                        ${Number(notification.metadata.amount).toLocaleString('es-AR')}
                      </Badge>
                    )}
                    {notification.metadata?.guestName && (
                      <Badge variant="secondary" className="text-xs">
                        {notification.metadata.guestName}
                      </Badge>
                    )}
                    {notification.metadata?.status && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                        {notification.metadata.status}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground" title={format(notification.createdAt, 'dd/MM/yyyy HH:mm:ss', { locale: es })}>
                      {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
