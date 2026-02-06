import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, LogIn, LogOut, Sparkles, AlertTriangle } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'CHECK_IN' | 'CHECK_OUT' | 'CLEANING' | 'ISSUE';
    title: string;
    description: string;
    time: string;
}

// Mock Data generator could be improved
const mockActivities: ActivityItem[] = [
    { id: '1', type: 'CHECK_IN', title: 'Check-in: Juan Perez', description: 'Habitación 305', time: 'Hace 5 min' },
    { id: '2', type: 'CLEANING', title: 'Limpieza Completada', description: 'Habitación 201 por Maria', time: 'Hace 15 min' },
    { id: '3', type: 'ISSUE', title: 'Reporte de Mantenimiento', description: 'Aire acondicionado Hab. 104', time: 'Hace 30 min' },
    { id: '4', type: 'CHECK_OUT', title: 'Check-out: Ana Garcia', description: 'Habitación 402 liberada', time: 'Hace 1 hora' },
];

export function LiveActivityFeed() {
    const getIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'CHECK_IN': return <LogIn className="w-4 h-4 text-blue-500" />;
            case 'CHECK_OUT': return <LogOut className="w-4 h-4 text-slate-500" />;
            case 'CLEANING': return <Sparkles className="w-4 h-4 text-emerald-500" />;
            case 'ISSUE': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
        }
    };

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 h-full border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Actividad Reciente
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal bg-white/50">En vivo</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-4">
                        {mockActivities.map((item, index) => (
                            <div key={item.id} className="relative pl-6 pb-1 group">
                                {/* Timeline Line */}
                                {index !== mockActivities.length - 1 && (
                                    <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-slate-100 dark:bg-slate-800" />
                                )}

                                <div className="absolute left-0 top-1 p-1 bg-white dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm z-10">
                                    {getIcon(item.type)}
                                </div>

                                <div className="ml-2 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.title}</p>
                                        <span className="text-[10px] text-muted-foreground font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{item.time}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
