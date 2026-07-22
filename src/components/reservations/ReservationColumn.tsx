
import { Droppable } from '@hello-pangea/dnd';
import { BookingStatus } from '@/types/hotel';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReservationColumnProps {
    id: BookingStatus;
    title: string;
    count: number;
    headerColorClass: string;
    children: React.ReactNode;
}

export function ReservationColumn({ id, title, count, headerColorClass, children }: ReservationColumnProps) {
    // Sin ancho fijo: la columna se estira a lo que le dé el tablero. Con 320px
    // fijos, cuatro columnas no entraban y aparecía el scroll lateral siempre.
    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full ring-2 ring-opacity-50", headerColorClass)} />
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        {title}
                    </h3>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                        {count}
                    </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                </Button>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "flex-1 rounded-3xl p-2 transition-colors duration-300 overflow-y-auto scrollbar-hide",
                            snapshot.isDraggingOver ? "bg-slate-50/80 dark:bg-slate-900/50 ring-2 ring-dashed ring-slate-200" : "bg-transparent"
                        )}
                    >
                        {children}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
}
