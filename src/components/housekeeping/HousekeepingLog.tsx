import { useMemo, useState } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Clock, CircleDashed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, formatLocalDate } from '@/lib/utils';
import type { HousekeepingTask, Room } from '@/types/hotel';

interface HousekeepingLogProps {
  tasks: HousekeepingTask[];
  rooms: Room[];
}

const hhmm = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : format(d, 'HH:mm');
};

/**
 * Chronological view of what happened to each room on a given day. The board
 * next to it shows the current state; this answers "what was done, and when".
 */
export function HousekeepingLog({ tasks, rooms }: HousekeepingLogProps) {
  const [day, setDay] = useState<Date>(new Date());
  const [open, setOpen] = useState(true);

  const roomNumber = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, r.roomNumber]));
    return (id: string) => map.get(id) || '—';
  }, [rooms]);

  const entries = useMemo(() => {
    const dayStr = formatLocalDate(day);

    return tasks
      .filter((t) => formatLocalDate(new Date(t.date)) === dayStr)
      .map((t) => ({
        id: t.id,
        room: roomNumber(t.roomId),
        status: t.status,
        assignedTo: t.assignedTo,
        startedAt: hhmm(t.startedAt),
        completedAt: hhmm(t.completedAt),
        durationMinutes: t.durationMinutes,
        // Sort by the most recent thing that happened to the task.
        sortKey: t.completedAt || t.startedAt || t.date,
      }))
      .sort((a, b) => {
        // Finished last shows first: the log reads newest-first.
        const at = new Date(a.sortKey as string | Date).getTime();
        const bt = new Date(b.sortKey as string | Date).getTime();
        return bt - at;
      });
  }, [tasks, day, roomNumber]);

  const done = entries.filter((e) => e.status === 'DONE');
  // There is nothing to log past today, so stop the day navigator there.
  const atToday = formatLocalDate(day) >= formatLocalDate(new Date());

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 pl-4">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-2 text-left min-w-0">
              <ChevronDown
                className={cn('w-4 h-4 shrink-0 transition-transform', !open && '-rotate-90')}
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Registro de limpieza</p>
                <p className="text-xs text-muted-foreground truncate">
                  {done.length} de {entries.length} habitaciones limpiadas
                </p>
              </div>
            </button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDay((d) => addDays(d, -1))}
              aria-label="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium w-24 text-center tabular-nums">
              {isToday(day) ? 'Hoy' : format(day, "d 'de' MMM", { locale: es })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDay((d) => addDays(d, 1))}
              disabled={atToday}
              aria-label="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t max-h-64 overflow-y-auto">
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground p-4">
                No hubo movimientos de limpieza {isToday(day) ? 'hoy' : 'ese día'}.
              </p>
            )}

            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 text-sm"
              >
                {e.status === 'DONE' && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                {e.status === 'IN_PROGRESS' && (
                  <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                {e.status === 'TODO' && (
                  <CircleDashed className="w-4 h-4 shrink-0 text-muted-foreground" />
                )}

                <span className="font-semibold tabular-nums w-16 shrink-0">
                  Hab. {e.room}
                </span>

                <span className="text-muted-foreground truncate flex-1 min-w-0">
                  {e.status === 'DONE' && (
                    <>
                      Limpiada {e.completedAt ? `a las ${e.completedAt}` : ''}
                      {e.durationMinutes ? ` · ${e.durationMinutes} min` : ''}
                    </>
                  )}
                  {e.status === 'IN_PROGRESS' && (
                    <>Limpiando {e.startedAt ? `desde las ${e.startedAt}` : ''}</>
                  )}
                  {e.status === 'TODO' && <>Pendiente</>}
                  {e.assignedTo ? ` · ${e.assignedTo}` : ''}
                </span>

                {e.status === 'TODO' && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Sucia
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
