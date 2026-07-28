import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GUEST_RATING_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Guest } from '@/types/hotel';
import { RATING_STYLES } from './GuestRatingBadge';

interface GuestRatingAlertProps {
  guest?: Guest;
  className?: string;
}

/**
 * El aviso donde se elige al huésped para una reserva.
 *
 * Solo para "Con reparos" y "No deseado": la calificación buena no cambia
 * ninguna decisión, y un cartel en cada reserva se vuelve paisaje.
 *
 * No bloquea. Puede ser un homónimo, o el hotel puede decidir alojarlo igual;
 * lo que faltaba era enterarse antes y no el día que llega.
 */
export function GuestRatingAlert({ guest, className }: GuestRatingAlertProps) {
  const rating = guest?.rating;
  if (!guest || (rating !== 'ATENCION' && rating !== 'NO_DESEADO')) return null;

  const style = RATING_STYLES[rating];
  const Icon = style.icon;

  return (
    <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border', style.panel, className)}>
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', style.accent)} />
      <div className="min-w-0 space-y-1">
        <p className={cn('text-sm font-semibold', style.accent)}>
          {GUEST_RATING_LABELS[rating]}
          {rating === 'NO_DESEADO' && ' — revisá antes de confirmar'}
        </p>
        {guest.ratingNotes ? (
          <p className="text-xs leading-relaxed whitespace-pre-line">{guest.ratingNotes}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Sin detalle cargado. Está en la ficha del huésped.
          </p>
        )}
        {(guest.ratingBy || guest.ratingAt) && (
          <p className="text-[11px] text-muted-foreground">
            {guest.ratingBy || 'Cargado'}
            {guest.ratingAt ? ` · ${format(guest.ratingAt, "d MMM yyyy", { locale: es })}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
