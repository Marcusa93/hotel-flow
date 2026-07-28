import { ThumbsUp, AlertTriangle, Ban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GUEST_RATING_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { GuestRating } from '@/types/hotel';

/** El color y el ícono de cada calificación, en un solo lugar: la etiqueta
 *  aparece en la ficha, en la tarjeta y en el aviso al reservar, y tienen que
 *  leerse como la misma cosa en los tres lados. */
export const RATING_STYLES: Record<GuestRating, {
  icon: LucideIcon;
  badge: string;
  panel: string;
  accent: string;
}> = {
  BUENO: {
    icon: ThumbsUp,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    panel: 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  ATENCION: {
    icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    panel: 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  NO_DESEADO: {
    icon: Ban,
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    panel: 'border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/20',
    accent: 'text-rose-600 dark:text-rose-400',
  },
};

interface GuestRatingBadgeProps {
  rating?: GuestRating;
  className?: string;
  /** Solo el ícono, para donde no entra el texto. */
  iconOnly?: boolean;
}

/** Nada para el huésped sin calificar: la mayoría lo está, y una etiqueta
 *  "sin calificar" en cada tarjeta sería ruido en vez de información. */
export function GuestRatingBadge({ rating, className, iconOnly }: GuestRatingBadgeProps) {
  if (!rating) return null;

  const style = RATING_STYLES[rating];
  const Icon = style.icon;
  const label = GUEST_RATING_LABELS[rating] || rating;

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        style.badge,
        className
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {!iconOnly && label}
    </span>
  );
}
