import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, LogIn, LogOut, CalendarCheck, Clock } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function LiveActivityFeed() {
    const { bookings, guests, rooms } = useHotel();

    // Derive generic activities from bookings
    // In a real app, you might have a dedicated 'ActivityLog' table.
    // Here we simulate it by looking at recent bookings/changes provided by the context state.

    const recentActivities = bookings
        .slice(0, 10) // Take last 10
        .sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
        })
        .map(booking => {
            const guest = guests.find(g => g.id === booking.guestId);
            const room = rooms.find(r => r.id === booking.roomId);

            // Use updatedAt if available, otherwise createdAt
            const activityTime = booking.updatedAt || booking.createdAt;

            let type: 'CHECK_IN' | 'CHECK_OUT' | 'NEW_BOOKING' = 'NEW_BOOKING';
            let title = 'Nueva Reserva';
            let description = `${guest?.fullName} - Hab. ${room?.roomNumber || '?'}`;
            let icon = <CalendarCheck className="w-4 h-4 text-primary" />;

            if (booking.status === 'CHECKED_IN') {
                type = 'CHECK_IN';
                title = 'Check-in Realizado';
                icon = <LogIn className="w-4 h-4 text-emerald-500" />;
            } else if (booking.status === 'CHECKED_OUT') {
                type = 'CHECK_OUT';
                title = 'Check-out Completado';
                icon = <LogOut className="w-4 h-4 text-slate-500" />;
            }

            return {
                id: booking.id,
                type,
                title,
                description,
                time: activityTime.toString(), // Ensure string string for display helper
                icon
            };
        });

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 h-full border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Actividad Reciente
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal bg-white/50 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        En vivo
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] pr-4">
                    {recentActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Clock className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No hay actividad reciente</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivities.map((item, index) => (
                                <div key={item.id} className="relative pl-6 pb-1 group">
                                    {/* Timeline Line */}
                                    {index !== recentActivities.length - 1 && (
                                        <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-slate-100 dark:bg-slate-800" />
                                    )}

                                    <div className="absolute left-0 top-1 p-1 bg-white dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm z-10">
                                        {item.icon}
                                    </div>

                                    <div className="ml-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all hover:bg-white/80">
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.title}</p>
                                            <span className="text-[10px] text-muted-foreground font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded capitalize">
                                                {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
