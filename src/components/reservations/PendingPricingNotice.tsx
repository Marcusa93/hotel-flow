import { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/** Algo que espera precio: una estadía suelta o una reserva masiva. */
export interface PendingPricingItem {
    key: string;
    label: string;
    /** La gente ya entró y el sistema dice que no debe nada. Va en rojo. */
    urgent: boolean;
    onClick: () => void;
}

interface PendingPricingNoticeProps {
    items: PendingPricingItem[];
}

/**
 * Lo que espera que administración le ponga precio, en una línea.
 *
 * Antes eran dos recuadros apilados —tarifas especiales y reservas masivas— con
 * un chip por cada una. Con diez pendientes ocupaban 206px de los 900 de la
 * pantalla, y el tablero quedaba con alto para una tarjeta y media.
 *
 * Se pliega, no se esconde: la línea sigue estando y dice cuántas son y si
 * alguna es urgente, que es lo que hace levantar la vista. El detalle está a un
 * clic y queda abierto mientras se trabaja en eso.
 */
export function PendingPricingNotice({ items }: PendingPricingNoticeProps) {
    const [open, setOpen] = useState(false);
    if (items.length === 0) return null;

    const urgentes = items.filter(i => i.urgent).length;

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <div className={cn(
                'rounded-xl border transition-colors',
                urgentes > 0
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/25'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25',
            )}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left">
                    <Tag className={cn(
                        'w-4 h-4 shrink-0',
                        urgentes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
                    )} />
                    <span className={cn(
                        'flex-1 min-w-0 truncate text-sm font-semibold',
                        urgentes > 0 ? 'text-rose-900 dark:text-rose-200' : 'text-amber-900 dark:text-amber-200',
                    )}>
                        {items.length === 1
                            ? 'Hay una reserva esperando precio'
                            : `Hay ${items.length} reservas esperando precio`}
                        {urgentes > 0 && (
                            <span className="font-bold">
                                {' · '}
                                {urgentes === 1 ? 'una ya entró' : `${urgentes} ya entraron`}
                            </span>
                        )}
                    </span>
                    <ChevronDown className={cn(
                        'w-4 h-4 shrink-0 opacity-60 transition-transform',
                        open && 'rotate-180',
                    )} />
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="flex flex-wrap gap-2 px-3 pb-3 pt-0.5">
                        {items.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={item.onClick}
                                className={cn(
                                    'rounded-lg border bg-white/70 dark:bg-slate-900/50 px-2.5 py-1 text-xs transition-colors',
                                    'hover:bg-white dark:hover:bg-slate-900',
                                    item.urgent
                                        ? 'border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-200 font-semibold'
                                        : 'border-amber-300 text-amber-900 dark:border-amber-800/60 dark:text-amber-200',
                                )}
                            >
                                {item.label}
                                {item.urgent && ' · ya entró'}
                            </button>
                        ))}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
