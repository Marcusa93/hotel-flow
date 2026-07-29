import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, CheckCircle2, StickyNote, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoomHandoverDialog, type RoomHandoverResult } from '@/components/housekeeping';
import { useSetHousekeepingHold } from '@/hooks/useRoomHousekeepingHold';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { errorToast } from '@/lib/toast-utils';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/hotel';

interface RoomHousekeepingPanelProps {
  room: Room;
}

/**
 * La habilitación de limpieza en la ficha de la habitación.
 *
 * Lo normal es que se decida al terminar la limpieza, pero el problema no
 * siempre aparece ahí: la almohada que falta se descubre a la tarde. Por eso
 * también se puede dejar el aviso —o levantarlo— desde acá.
 */
export function RoomHousekeepingPanel({ room }: RoomHousekeepingPanelProps) {
  const { currentRole, profileName } = useAppRole();
  const { user } = useAuth();
  const setHold = useSetHousekeepingHold();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // El pedido era que la habilitación fuera de limpieza. El trigger de la base
  // lo hace cumplir; esto es para no mostrar un botón que va a fallar.
  const canDecide = currentRole === 'housekeeping' || currentRole === 'admin';

  const hasHold = room.housekeepingHold === true;
  const hasNote = !!room.housekeepingNote;

  const handleConfirm = async ({ hold, note }: RoomHandoverResult) => {
    try {
      await setHold.mutateAsync({
        roomId: room.id,
        roomNumber: room.roomNumber,
        hold,
        note,
        by: profileName || user?.email || undefined,
      });
      toast({
        title: hold ? '🚫 Habitación sin habilitar' : '✅ Habitación habilitada',
        description: hold ? 'Recepción va a ver el motivo' : undefined,
      });
    } catch (error) {
      errorToast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      });
      throw error;
    }
  };

  const enableNow = async () => {
    await handleConfirm({ hold: false, note: undefined });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Habilitación de limpieza
      </h3>

      <div
        className={cn(
          'rounded-xl border p-3 space-y-2',
          hasHold
            ? 'border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30'
            : hasNote
              ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20'
        )}
      >
        <div className="flex items-start gap-2">
          {hasHold ? (
            <Ban className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : hasNote ? (
            <StickyNote className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold">
              {hasHold
                ? 'No habilitada por limpieza'
                : hasNote
                  ? 'Habilitada, con un aviso'
                  : 'Habilitada'}
            </p>

            {room.housekeepingNote && (
              <p className="text-[13px] leading-snug">{room.housekeepingNote}</p>
            )}

            {(room.housekeepingNoteBy || room.housekeepingNoteAt) && (
              <p className="text-[11px] text-muted-foreground">
                {room.housekeepingNoteBy || 'Limpieza'}
                {room.housekeepingNoteAt
                  ? ` · ${format(room.housekeepingNoteAt, "d MMM, HH:mm", { locale: es })}`
                  : ''}
              </p>
            )}

            {!hasHold && !hasNote && (
              <p className="text-[13px] text-muted-foreground leading-snug">
                Sin observaciones de limpieza.
              </p>
            )}
          </div>
        </div>

        {canDecide && (
          <div className="flex flex-wrap gap-2 pt-1">
            {hasHold && (
              <Button
                size="sm"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                disabled={setHold.isPending}
                onClick={enableNow}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Habilitar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              disabled={setHold.isPending}
              onClick={() => setIsDialogOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {hasHold || hasNote ? 'Cambiar' : 'Dejar aviso'}
            </Button>
          </div>
        )}
      </div>

      <RoomHandoverDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        room={room}
        onConfirm={handleConfirm}
        seedFromRoom
        description="Recepción ve esto antes de alojar a alguien en esta habitación."
        confirmLabels={{ enable: 'Guardar', hold: 'Guardar sin habilitar' }}
      />
    </section>
  );
}
