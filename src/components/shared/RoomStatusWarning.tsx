import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomCheckInWarning } from '@/lib/roomReadiness';

interface RoomStatusWarningProps {
  /** El aviso que devuelve getRoomCheckInWarning. Sin aviso no se dibuja nada. */
  warning: RoomCheckInWarning | null | undefined;
  className?: string;
}

/**
 * El cartel del estado de la habitación en los diálogos de check-in.
 * Vive en un solo lugar para que los cuatro caminos de check-in avisen igual.
 */
export function RoomStatusWarning({ warning, className }: RoomStatusWarningProps) {
  if (!warning) return null;

  const isCritical = warning.severity === 'critical';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm text-left',
        isCritical
          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        className
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="font-semibold">{warning.title}</p>
        <p className="text-[13px] leading-snug opacity-90">{warning.message}</p>
      </div>
    </div>
  );
}
