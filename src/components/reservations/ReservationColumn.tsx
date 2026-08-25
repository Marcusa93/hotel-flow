import { useCallback, useEffect, useRef, useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { BookingStatus } from '@/types/hotel';
import { cn } from '@/lib/utils';

interface ReservationColumnProps {
    id: BookingStatus;
    title: string;
    count: number;
    headerColorClass: string;
    /**
     * Qué quedó afuera de la columna. Sin esto, filtrar se lee como perder datos.
     *
     * Va al pie de la lista y no en el encabezado: arriba le sumaba un renglón
     * a una sola de las cuatro columnas y les corría las tarjetas hacia abajo
     * respecto de las otras tres. Abajo además se lee cuando corresponde —
     * llegaste al final de las salidas de hoy y ahí te enterás que hay viejas.
     */
    hint?: string;
    children: React.ReactNode;
}

export function ReservationColumn({ id, title, count, headerColorClass, hint, children }: ReservationColumnProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    /** Cuántas tarjetas entran, si sobra contenido, y si quedó algo abajo. */
    const [visibles, setVisibles] = useState(count);
    const [sobra, setSobra] = useState(false);
    const [hayMasAbajo, setHayMasAbajo] = useState(false);

    /**
     * Cuántas caben y si sobra contenido.
     *
     * Se mide el alto real de las tarjetas en vez de suponerlo: la tarjeta
     * cambió de tamaño una vez y cualquier número escrito acá habría quedado
     * mintiendo en silencio.
     */
    const medir = useCallback(() => {
        const caja = scrollRef.current;
        if (!caja) return;

        const tarjetas = caja.querySelectorAll('[data-rfd-draggable-id]');
        const alto = tarjetas[0]?.getBoundingClientRect().height ?? 0;
        setVisibles(alto > 0 ? Math.max(1, Math.floor(caja.clientHeight / alto)) : count);
        // Si el contador dice "de" se decide por lo que de verdad quedó afuera,
        // no por la cuenta de cuántas entran: con cinco tarjetas y lugar para
        // cuatro y media, "4 de 5" es cierto pero suena a que falta media
        // pantalla. El margen de 8px absorbe el redondeo de un pixel.
        setSobra(caja.scrollHeight - caja.clientHeight > 8);
        setHayMasAbajo(caja.scrollHeight - caja.clientHeight - caja.scrollTop > 8);
    }, [count]);

    useEffect(() => {
        const caja = scrollRef.current;
        if (!caja) return;
        medir();
        const observer = new ResizeObserver(medir);
        observer.observe(caja);
        return () => observer.disconnect();
    }, [medir, children]);

    // Que el encabezado diga "4 de 81" y no sólo "81": el problema no era el
    // scroll sino no saber que había 77 reservas más abajo.
    const parcial = sobra && count > visibles;

    return (
        <div className="flex flex-col h-full w-full min-h-0">
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full ring-2 ring-opacity-50 shrink-0', headerColorClass)} />
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate">
                        {title}
                    </h3>
                </div>
                <span
                    className="shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
                    title={parcial ? `Se ven ${visibles} de ${count}. Scrolleá la columna para ver el resto.` : undefined}
                >
                    {parcial ? `${visibles} de ${count}` : count}
                </span>
            </div>

            {/* El degradado del pie avisa que el contenido sigue. Va sobre el
                área de scroll y no adentro, así no se mueve con las tarjetas. */}
            <div className="relative flex-1 min-h-0">
                <Droppable droppableId={id}>
                    {(provided, snapshot) => (
                        <div
                            ref={(el) => { provided.innerRef(el); scrollRef.current = el; }}
                            {...provided.droppableProps}
                            onScroll={medir}
                            className={cn(
                                // Barra de scroll fina pero visible: antes estaba
                                // oculta y la columna parecía terminar donde
                                // terminaba la pantalla.
                                'h-full rounded-3xl p-2 overflow-y-auto transition-colors duration-300',
                                '[scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]',
                                'dark:[scrollbar-color:theme(colors.slate.700)_transparent]',
                                snapshot.isDraggingOver
                                    ? 'bg-slate-50/80 dark:bg-slate-900/50 ring-2 ring-dashed ring-slate-200'
                                    : 'bg-transparent',
                            )}
                        >
                            {children}
                            {provided.placeholder}
                            {hint && (
                                <p className="px-2 pt-2 pb-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                                    {hint}
                                </p>
                            )}
                        </div>
                    )}
                </Droppable>

                {hayMasAbajo && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-2 bottom-0 h-10 rounded-b-3xl bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent"
                    />
                )}
            </div>
        </div>
    );
}

/**
 * El título de un tramo adentro de la columna.
 *
 * Pegajoso: al scrollear queda arriba y siempre se sabe qué se está mirando,
 * que es todo el punto de tener separadores.
 */
export function ReservationGroupHeader({ label, count }: { label: string; count: number }) {
    return (
        <div className="sticky top-0 z-10 -mx-2 mb-2 px-3 py-1.5 backdrop-blur-sm bg-slate-50/85 dark:bg-slate-950/85">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
                <span className="font-semibold text-slate-400 dark:text-slate-500 tabular-nums">{count}</span>
            </p>
        </div>
    );
}
