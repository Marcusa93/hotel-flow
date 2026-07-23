import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Paintbrush, Play, CheckCircle2, AlertCircle, Sparkles, Undo2, User, AlertTriangle } from 'lucide-react';
import { Room, HousekeepingTask, HousekeepingStatus } from '@/types/hotel';
import { cn } from '@/lib/utils';
import { ElapsedTimer } from '@/components/shared';

interface HousekeepingBoardProps {
    rooms: Room[];
    tasks: HousekeepingTask[];
    onStatusChange: (taskId: string, status: HousekeepingStatus) => void;
}

function RoomCard({ room, task, onStatusChange }: { room: Room; task?: HousekeepingTask; onStatusChange: HousekeepingBoardProps['onStatusChange'] }) {
    const [pendingAction, setPendingAction] = useState<'forward' | 'revert' | null>(null);

    const getRoomStatusColor = (status: string, taskStatus?: string) => {
        if (taskStatus === 'IN_PROGRESS') return 'border-amber-400 bg-amber-50 dark:bg-amber-900/10';
        if (taskStatus === 'DONE') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10';
        if (status === 'DIRTY') return 'border-rose-400 bg-rose-50 dark:bg-rose-900/10';
        return 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20';
    };

    const isDirty = room.status === 'DIRTY';
    const isCheckout = task?.priority === 'CHECKOUT';
    const isUrgent = task?.priority === 'URGENT';

    const handleForward = () => {
        if (!task) return;
        if (pendingAction !== 'forward') {
            setPendingAction('forward');
            setTimeout(() => setPendingAction(null), 4000);
            return;
        }
        setPendingAction(null);
        if (task.status === 'TODO') onStatusChange(task.id, 'IN_PROGRESS');
        else if (task.status === 'IN_PROGRESS') onStatusChange(task.id, 'DONE');
    };

    const handleRevert = () => {
        if (!task) return;
        if (pendingAction !== 'revert') {
            setPendingAction('revert');
            setTimeout(() => setPendingAction(null), 4000);
            return;
        }
        setPendingAction(null);
        if (task.status === 'DONE') onStatusChange(task.id, 'IN_PROGRESS');
        else if (task.status === 'IN_PROGRESS') onStatusChange(task.id, 'TODO');
    };

    return (
        <Card
            className={cn(
                "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-l-4",
                getRoomStatusColor(room.status, task?.status),
                (isCheckout || isUrgent) && task?.status === 'TODO' && "ring-1 ring-rose-300"
            )}
        >
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
                <span className="text-xs font-mono text-muted-foreground mb-1">Piso {room.floor}</span>
                <h3 className="num-display text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">
                    {room.roomNumber}
                </h3>

                {/* Priority indicator */}
                {task && (isCheckout || isUrgent) && task.status !== 'DONE' && (
                    <Badge className={cn("mb-1 text-[10px]", isCheckout ? "bg-rose-500 text-white animate-pulse" : "bg-amber-500 text-white")}>
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        {isCheckout ? 'CHECKOUT' : 'URGENTE'}
                    </Badge>
                )}

                {/* Assignee */}
                {task?.assignedTo && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                        <User className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[80px]">{task.assignedTo}</span>
                    </div>
                )}

                {/* Status Badge */}
                {task?.status === 'IN_PROGRESS' && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 animate-pulse border-amber-200 whitespace-nowrap">
                        <Paintbrush className="w-3 h-3 mr-1" />
                        Limpiando
                        <ElapsedTimer startedAt={task.startedAt} prefix="·" className="ml-1 font-mono tabular-nums" />
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
                    <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                        {pendingAction === 'forward' ? (
                            <Button size="sm" onClick={handleForward} className={cn(
                                "w-full",
                                task.status === 'TODO' ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                            )}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar
                            </Button>
                        ) : (
                            <Button size="sm" onClick={handleForward} className={cn(
                                "w-full",
                                task.status === 'TODO' ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"
                            )}>
                                {task.status === 'TODO' ? (
                                    <><Play className="w-4 h-4 mr-1" /> Empezar</>
                                ) : (
                                    <><CheckCircle2 className="w-4 h-4 mr-1" /> Terminar</>
                                )}
                            </Button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                            <Button size="sm" variant="outline" onClick={handleRevert} className={cn("w-full text-xs", pendingAction === 'revert' && "ring-2 ring-blue-400")}>
                                <Undo2 className="w-3 h-3 mr-1" /> {pendingAction === 'revert' ? 'Confirmar' : 'Volver'}
                            </Button>
                        )}
                    </div>
                )}

                {/* Revert overlay for DONE tasks */}
                {task?.status === 'DONE' && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center p-3">
                        <Button size="sm" variant="outline" onClick={handleRevert} className={cn("w-full", pendingAction === 'revert' && "ring-2 ring-blue-400 bg-blue-50")}>
                            <Undo2 className="w-4 h-4 mr-1" /> {pendingAction === 'revert' ? 'Confirmar reabrir' : 'Reabrir tarea'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function HousekeepingBoard({ rooms, tasks, onStatusChange }: HousekeepingBoardProps) {
    const sortedRooms = [...rooms].sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.roomNumber.localeCompare(b.roomNumber);
    });

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedRooms.map(room => {
                const task = tasks.find(t => t.roomId === room.id);
                return (
                    <RoomCard
                        key={room.id}
                        room={room}
                        task={task}
                        onStatusChange={onStatusChange}
                    />
                );
            })}
        </div>
    );
}
