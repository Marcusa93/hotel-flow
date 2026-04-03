import { useMemo, useState } from 'react';
import { ClipboardList, RefreshCw, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { HousekeepingTask, Room, HousekeepingStatus, TaskPriority } from '@/types/hotel';
import { MobileTaskCard } from './MobileTaskCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileTaskListProps {
    tasks: HousekeepingTask[];
    rooms: Room[];
    onStatusChange: (taskId: string, status: HousekeepingStatus, startedAt?: Date, completedAt?: Date) => void;
    onEdit?: (task: HousekeepingTask) => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const priorityOrder: Record<TaskPriority, number> = {
    CHECKOUT: 0,
    URGENT: 1,
    NORMAL: 2,
    LOW: 3,
};

function CompletedSection({ tasks, rooms, onStatusChange, onEdit }: {
    tasks: HousekeepingTask[];
    rooms: Room[];
    onStatusChange: MobileTaskListProps['onStatusChange'];
    onEdit?: MobileTaskListProps['onEdit'];
}) {
    const [expanded, setExpanded] = useState(false);
    const displayed = expanded ? tasks : tasks.slice(0, 3);
    const hasMore = tasks.length > 3;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Completadas ({tasks.length})
            </h3>
            <div className="space-y-3 opacity-70">
                {displayed.map(task => {
                    const room = rooms.find(r => r.id === task.roomId);
                    if (!room) return null;
                    return (
                        <MobileTaskCard
                            key={task.id}
                            task={task}
                            room={room}
                            onStatusChange={onStatusChange}
                            onEdit={onEdit}
                        />
                    );
                })}
                {hasMore && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(!expanded)}
                        className="w-full text-muted-foreground"
                    >
                        {expanded ? (
                            <><ChevronUp className="w-4 h-4 mr-1" /> Mostrar menos</>
                        ) : (
                            <><ChevronDown className="w-4 h-4 mr-1" /> Ver las {tasks.length - 3} restantes</>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function MobileTaskList({ tasks, rooms, onStatusChange, onEdit, onRefresh, isRefreshing }: MobileTaskListProps) {
    // Sort tasks by priority, then by status (TODO first), then by date
    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            // First by priority
            const priorityA = priorityOrder[a.priority || 'NORMAL'];
            const priorityB = priorityOrder[b.priority || 'NORMAL'];
            if (priorityA !== priorityB) return priorityA - priorityB;

            // Then by status (TODO > IN_PROGRESS > DONE)
            const statusOrder: Record<HousekeepingStatus, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
            const statusA = statusOrder[a.status];
            const statusB = statusOrder[b.status];
            if (statusA !== statusB) return statusA - statusB;

            // Then by date
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [tasks]);

    // Group by status for visual separation
    const todoTasks = sortedTasks.filter(t => t.status === 'TODO');
    const inProgressTasks = sortedTasks.filter(t => t.status === 'IN_PROGRESS');
    const doneTasks = sortedTasks.filter(t => t.status === 'DONE');

    const checkoutCount = todoTasks.filter(t => t.priority === 'CHECKOUT').length;

    const getRoomForTask = (task: HousekeepingTask) => {
        return rooms.find(r => r.id === task.roomId);
    };

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                    <ClipboardList className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    ¡Todo limpio! 🎉
                </h3>
                <p className="text-muted-foreground max-w-sm">
                    No tienes tareas pendientes por ahora. Buen trabajo.
                </p>
                {onRefresh && (
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        className="mt-6"
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                        Actualizar
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Pull to refresh indicator */}
            {onRefresh && (
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="text-muted-foreground"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                        {isRefreshing ? 'Actualizando...' : 'Actualizar lista'}
                    </Button>
                </div>
            )}

            {/* Urgent Alert Banner */}
            {checkoutCount > 0 && (
                <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl p-4 shadow-lg flex items-center gap-3 animate-pulse">
                    <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-bold text-lg">
                            {checkoutCount} Checkout{checkoutCount > 1 ? 's' : ''} pendiente{checkoutCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-white/80 text-sm">
                            Requieren atención inmediata
                        </p>
                    </div>
                </div>
            )}

            {/* In Progress Section */}
            {inProgressTasks.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 px-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        En Progreso ({inProgressTasks.length})
                    </h3>
                    <div className="space-y-3">
                        {inProgressTasks.map(task => {
                            const room = getRoomForTask(task);
                            if (!room) return null;
                            return (
                                <MobileTaskCard
                                    key={task.id}
                                    task={task}
                                    room={room}
                                    onStatusChange={onStatusChange}
                                    onEdit={onEdit}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Pending Section */}
            {todoTasks.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-rose-600 dark:text-rose-400 px-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Pendientes ({todoTasks.length})
                    </h3>
                    <div className="space-y-3">
                        {todoTasks.map(task => {
                            const room = getRoomForTask(task);
                            if (!room) return null;
                            return (
                                <MobileTaskCard
                                    key={task.id}
                                    task={task}
                                    room={room}
                                    onStatusChange={onStatusChange}
                                    onEdit={onEdit}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Completed Section */}
            {doneTasks.length > 0 && (
                <CompletedSection
                    tasks={doneTasks}
                    rooms={rooms}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                />
            )}
        </div>
    );
}
