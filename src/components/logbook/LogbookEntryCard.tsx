import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Shirt,
  Wine,
  Wrench,
  Package,
  User,
  StickyNote,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LOGBOOK_CATEGORY_LABELS } from '@/lib/constants';
import { describeRoomMovement } from '@/lib/logbook';
import { cn } from '@/lib/utils';
import type { LogbookCategory, LogbookEntry } from '@/types/hotel';

const CATEGORY_ICONS: Record<LogbookCategory, React.ComponentType<{ className?: string }>> = {
  ROPA_BLANCA: Shirt,
  MINIBAR: Wine,
  MANTENIMIENTO: Wrench,
  OBJETOS_OLVIDADOS: Package,
  HUESPED: User,
  OTRO: StickyNote,
};

interface LogbookEntryCardProps {
  entry: LogbookEntry;
  roomNumberById: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  onResolve: (entry: LogbookEntry) => void;
  onReopen: (entry: LogbookEntry) => void;
  onEdit: (entry: LogbookEntry) => void;
  onDelete: (entry: LogbookEntry) => void;
}

export function LogbookEntryCard({
  entry,
  roomNumberById,
  canEdit,
  canDelete,
  onResolve,
  onReopen,
  onEdit,
  onDelete,
}: LogbookEntryCardProps) {
  const Icon = CATEGORY_ICONS[entry.category] || StickyNote;
  const movement = describeRoomMovement(
    entry.roomFromId ? roomNumberById[entry.roomFromId] : undefined,
    entry.roomToId ? roomNumberById[entry.roomToId] : undefined
  );

  const isPending = entry.status === 'PENDING';
  const isResolved = entry.status === 'RESOLVED';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        // Lo pendiente se tiene que ver distinto sin leerlo: es lo único que
        // le pide algo a quien entra al turno.
        isPending
          ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20'
          : 'bg-card/60 hover:bg-card',
        isResolved && 'opacity-75'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            isPending
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {LOGBOOK_CATEGORY_LABELS[entry.category] || entry.category}
            </Badge>
            {movement && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {movement}
              </Badge>
            )}
            {isPending && (
              <Badge className="text-[10px] bg-amber-500 text-white hover:bg-amber-500">
                Pendiente
              </Badge>
            )}
            {isResolved && (
              <Badge className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-600">
                Resuelta
              </Badge>
            )}
          </div>

          <p className={cn('text-sm leading-relaxed break-words', isResolved && 'line-through')}>
            {entry.note}
          </p>

          <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(entry.date, "d MMM yyyy, HH:mm", { locale: es })}
            {entry.createdByName && <span>· {entry.createdByName}</span>}
          </p>

          {isResolved && entry.resolvedAt && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Resuelta el {format(entry.resolvedAt, "d MMM, HH:mm", { locale: es })}
              {entry.resolvedByName ? ` por ${entry.resolvedByName}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-emerald-600 hover:text-emerald-700"
              onClick={() => onResolve(entry)}
            >
              <Check className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Resolver</span>
            </Button>
          )}
          {canEdit && isResolved && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onReopen(entry)}
              aria-label="Volver a pendiente"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onEdit(entry)}
              aria-label="Editar novedad"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(entry)}
              aria-label="Eliminar novedad"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
