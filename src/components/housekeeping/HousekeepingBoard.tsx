import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Paintbrush, Play, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Room, HousekeepingTask } from '@/types/hotel';
import { cn } from '@/lib/utils';

interface HousekeepingBoardProps {
    rooms: Room[];
    tasks: HousekeepingTask[];
    onStatusChange: (taskId: string, status: 'IN_PROGRESS' | 'DONE') => void;
}

export function HousekeepingBoard({ rooms, tasks, onStatusChange }: HousekeepingBoardProps) {
    // Sort rooms by floor
    const sortedRooms = [...rooms].sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.roomNumber.localeCompare(b.roomNumber);
    });

    const getRoomStatusColor = (status: string, taskStatus?: string) => {
        if (taskStatus === 'IN_PROGRESS') return 'border-amber-400 bg-amber-50 dark:bg-amber-900/10';
        if (taskStatus === 'DONE') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10';
        if (status === 'DIRTY') return 'border-rose-400 bg-rose-50 dark:bg-rose-900/10';
        return 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20'; // Clean/Ready
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedRooms.map(room => {
                const task = tasks.find(t => t.roomId === room.id);
                const isDirty = room.status === 'DIRTY';
                const isCleaning = task?.status === 'IN_PROGRESS';
                const isDone = task?.status === 'DONE'; // Or room is CLEAN and task is done

                return (
                    <Card
                        key={room.id}
                        className={cn(
                            "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-l-4",
                            getRoomStatusColor(room.status, task?.status)
                        )}
                    >
                        <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
                            <span className="text-xs font-mono text-muted-foreground mb-1">Piso {room.floor}</span>
                            <h3 className="text-2xl font-bold tracking-tighter mb-2 text-slate-800 dark:text-slate-100">
                                {room.roomNumber}
                            </h3>

                            {/* Status Badge */}
                            {task?.status === 'IN_PROGRESS' && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 animate-pulse border-amber-200">
                                    <Paintbrush className="w-3 h-3 mr-1" /> Limpiando
                                </Badge>
                            )}
                            {task?.status === 'DONE' && (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                    <Sparkles className="w-3 h-3 mr-1" /> Lista
                                </Badge>
                            )}
                            {isDirty && !task && (
                                <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200">
                                    <AlertCircle className="w-3 h-3 mr-1" /> Sucia
                                </Badge>
                            )}
                            {!isDirty && !task && (
                                <Badge variant="outline" className="text-slate-500">
                                    Disponible
                                </Badge>
                            )}

                            {/* Actions Overlay */}
                            {task && task.status !== 'DONE' && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                    {task.status === 'TODO' && (
                                        <Button size="sm" onClick={() => onStatusChange(task.id, 'IN_PROGRESS')} className="w-full bg-amber-500 hover:bg-amber-600">
                                            <Play className="w-4 h-4 mr-2" /> Empezar
                                        </Button>
                                    )}
                                    {task.status === 'IN_PROGRESS' && (
                                        <Button size="sm" onClick={() => onStatusChange(task.id, 'DONE')} className="w-full bg-emerald-500 hover:bg-emerald-600">
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Terminar
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
