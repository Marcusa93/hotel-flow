import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, Clock, AlertTriangle, Sparkles, User, ChevronRight, Timer, Undo2, Pencil } from 'lucide-react';
import { HousekeepingTask, Room, TaskPriority, HousekeepingStatus } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileTaskCardProps {
    task: HousekeepingTask;
    room: Room;
    onStatusChange: (taskId: string, status: HousekeepingStatus, startedAt?: Date, completedAt?: Date) => void;
    onEdit?: (task: HousekeepingTask) => void;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; icon: React.ElementType }> = {
    CHECKOUT: { label: '¡CHECKOUT!', color: 'bg-rose-500 text-white animate-pulse', icon: AlertTriangle },
    URGENT: { label: 'Urgente', color: 'bg-amber-500 text-white', icon: AlertTriangle },
    NORMAL: { label: 'Normal', color: 'bg-slate-200 text-slate-700', icon: Clock },
    LOW: { label: 'Baja', color: 'bg-slate-100 text-slate-500', icon: Clock },
};

const statusConfig: Record<HousekeepingStatus, { label: string; color: string }> = {
    TODO: { label: 'Pendiente', color: 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/20' },
    IN_PROGRESS: { label: 'Limpiando', color: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20' },
    DONE: { label: 'Completada', color: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' },
};

export function MobileTaskCard({ task, room, onStatusChange, onEdit }: MobileTaskCardProps) {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isSwiped, setIsSwiped] = useState(false);
    const [pendingAction, setPendingAction] = useState<'forward' | 'revert' | null>(null);
    const confirmTimeoutRef = useRef<NodeJS.Timeout>();
    const touchStartX = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-dismiss confirmation after 4 seconds
    useEffect(() => {
        if (pendingAction) {
            confirmTimeoutRef.current = setTimeout(() => setPendingAction(null), 4000);
            return () => clearTimeout(confirmTimeoutRef.current);
        }
    }, [pendingAction]);

    const priority = task.priority || 'NORMAL';
    const priorityInfo = priorityConfig[priority];
    const statusInfo = statusConfig[task.status];
    const PriorityIcon = priorityInfo.icon;

    // Timer effect for IN_PROGRESS tasks
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (task.status === 'IN_PROGRESS' && task.startedAt) {
            const updateElapsed = () => {
                const start = new Date(task.startedAt!).getTime();
                const now = Date.now();
                setElapsedTime(Math.floor((now - start) / 1000));
            };

            updateElapsed();
            interval = setInterval(updateElapsed, 1000);
        }

        return () => clearInterval(interval);
    }, [task.status, task.startedAt]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Touch handlers for swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX.current;

        if (diff > 80 && task.status !== 'DONE') {
            // Swipe right - request confirmation
            setPendingAction('forward');
        } else if (diff < -80) {
            setIsSwiped(!isSwiped);
        }
    };

    const handleForwardAction = () => {
        if (!pendingAction || pendingAction !== 'forward') {
            setPendingAction('forward');
            return;
        }
        // Confirmed — execute
        setPendingAction(null);
        if (task.status === 'TODO') {
            onStatusChange(task.id, 'IN_PROGRESS', new Date(), undefined);
        } else if (task.status === 'IN_PROGRESS') {
            onStatusChange(task.id, 'DONE', undefined, new Date());
        }
    };

    const handleRevertAction = () => {
        if (!pendingAction || pendingAction !== 'revert') {
            setPendingAction('revert');
            return;
        }
        // Confirmed — revert
        setPendingAction(null);
        if (task.status === 'DONE') {
            onStatusChange(task.id, 'IN_PROGRESS');
        } else if (task.status === 'IN_PROGRESS') {
            onStatusChange(task.id, 'TODO');
        }
    };

    const isCheckout = priority === 'CHECKOUT';

    return (
        <div
            ref={cardRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
                "relative overflow-hidden rounded-2xl border-l-4 shadow-sm transition-all duration-300",
                statusInfo.color,
                isCheckout && task.status === 'TODO' && "ring-2 ring-rose-400 ring-offset-2",
                isSwiped && "translate-x-[-20%]"
            )}
        >
            {/* Checkout urgent indicator */}
            {isCheckout && task.status === 'TODO' && (
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-rose-500 border-l-[40px] border-l-transparent" />
            )}

            <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        {/* Room Number - Big and Bold */}
                        <div className="h-14 w-14 rounded-xl bg-white dark:bg-slate-800 shadow-md flex items-center justify-center">
                            <span className="text-2xl font-bold text-slate-800 dark:text-white">{room.roomNumber}</span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Piso {room.floor}</p>
                            <Badge className={cn('mt-1 text-xs', priorityInfo.color)}>
                                <PriorityIcon className="w-3 h-3 mr-1" />
                                {priorityInfo.label}
                            </Badge>
                        </div>
                    </div>

                    {/* Edit button */}
                    {onEdit && task.status !== 'DONE' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                        >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                    )}

                    {/* Timer (visible when IN_PROGRESS) */}
                    {task.status === 'IN_PROGRESS' && (
                        <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 px-3 py-2 rounded-xl">
                            <Timer className="w-5 h-5 text-amber-600 animate-pulse" />
                            <span className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400">
                                {formatTime(elapsedTime)}
                            </span>
                        </div>
                    )}

                    {/* Done badge */}
                    {task.status === 'DONE' && (
                        <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 rounded-xl">
                            <Sparkles className="w-5 h-5 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">
                                {task.durationMinutes ? `${task.durationMinutes} min` : 'Listo'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Assigned To */}
                {task.assignedTo && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{task.assignedTo}</span>
                    </div>
                )}

                {/* Notes */}
                {task.notes && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                        {task.notes}
                    </p>
                )}

                {/* Confirmation bar */}
                {pendingAction && (
                    <div className={cn(
                        "p-2.5 rounded-xl mb-3 text-center text-sm font-medium animate-in fade-in duration-200",
                        pendingAction === 'forward'
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                    )}>
                        {pendingAction === 'forward'
                            ? (task.status === 'TODO' ? '¿Empezar limpieza? Toca de nuevo para confirmar' : '¿Marcar como terminada? Toca de nuevo para confirmar')
                            : (task.status === 'DONE' ? '¿Reabrir tarea? Toca de nuevo para confirmar' : '¿Volver a pendiente? Toca de nuevo para confirmar')
                        }
                    </div>
                )}

                {/* Action Buttons */}
                {task.status !== 'DONE' && (
                    <div className="flex gap-2">
                        {/* Revert button for IN_PROGRESS */}
                        {task.status === 'IN_PROGRESS' && (
                            <Button
                                onClick={handleRevertAction}
                                variant="outline"
                                className={cn(
                                    "h-14 rounded-xl transition-all active:scale-95 shrink-0",
                                    pendingAction === 'revert' && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950/30"
                                )}
                            >
                                <Undo2 className="w-5 h-5" />
                            </Button>
                        )}
                        <Button
                            onClick={handleForwardAction}
                            className={cn(
                                "flex-1 h-14 text-base font-semibold rounded-xl shadow-lg transition-all active:scale-95",
                                pendingAction === 'forward' && "ring-2 ring-offset-2",
                                task.status === 'TODO'
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                            )}
                        >
                            {task.status === 'TODO' ? (
                                <>
                                    <Play className="w-5 h-5 mr-2" />
                                    {pendingAction === 'forward' ? 'Confirmar' : 'Empezar Limpieza'}
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    {pendingAction === 'forward' ? 'Confirmar' : 'Terminar Limpieza'}
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Revert button for DONE tasks */}
                {task.status === 'DONE' && (
                    <Button
                        onClick={handleRevertAction}
                        variant="outline"
                        size="sm"
                        className={cn(
                            "w-full mt-2 rounded-xl transition-all",
                            pendingAction === 'revert' && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950/30"
                        )}
                    >
                        <Undo2 className="w-4 h-4 mr-2" />
                        {pendingAction === 'revert' ? 'Toca para confirmar' : 'Reabrir tarea'}
                    </Button>
                )}

                {/* Swipe hint — only for actionable tasks */}
                {task.status !== 'DONE' && (
                    <div className="flex items-center justify-center mt-3 text-xs text-muted-foreground opacity-60">
                        <ChevronRight className="w-4 h-4 animate-pulse" />
                        <span>Desliza para acciones</span>
                    </div>
                )}
            </div>
        </div>
    );
}
