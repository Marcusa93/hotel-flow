import { useEffect, useState } from 'react';
import { CheckCircle2, Ban } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/hotel';

export interface RoomHandoverResult {
  /** true = no la habilito. */
  hold: boolean;
  note?: string;
}

interface RoomHandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | undefined;
  onConfirm: (result: RoomHandoverResult) => Promise<void>;
  /**
   * Los textos cambian según de dónde se abra: al terminar una limpieza la
   * tarea se cierra igual, y desde la ficha de la habitación no hay ninguna
   * tarea de por medio. La decisión que se toma es la misma.
   */
  description?: string;
  confirmLabels?: { enable: string; hold: string };
  /** Arranca con lo que la habitación tiene puesto, para poder corregirlo. */
  seedFromRoom?: boolean;
}

/**
 * Lo que se pregunta al terminar la limpieza: si la habitación queda habilitada.
 *
 * Antes el sistema lo daba por hecho y la mandaba a disponible sola. La que
 * estuvo adentro es la única que sabe si quedó en condiciones, y hasta ahora eso
 * se decía de palabra o no se decía.
 */
export function RoomHandoverDialog({
  open,
  onOpenChange,
  room,
  onConfirm,
  description,
  confirmLabels,
  seedFromRoom = false,
}: RoomHandoverDialogProps) {
  const [hold, setHold] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cada habitación arranca de cero: el "no la habilito" de la anterior no se
  // arrastra a la siguiente. Salvo cuando se abre para corregir lo que esa
  // misma habitación ya tiene puesto.
  useEffect(() => {
    if (!open) return;
    setHold(seedFromRoom ? room?.housekeepingHold ?? false : false);
    setNote(seedFromRoom ? room?.housekeepingNote ?? '' : '');
  }, [open, room?.id, room?.housekeepingHold, room?.housekeepingNote, seedFromRoom]);

  // Trabar sin decir por qué le deja a recepción un cartel rojo y ninguna
  // información; es justo lo que se venía haciendo de palabra.
  const noteRequired = hold;
  const canSubmit = (!noteRequired || note.trim().length > 0) && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onConfirm({ hold, note: note.trim() || undefined });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const label = room?.roomNumber ? `la ${room.roomNumber}` : 'la habitación';

  return (
    <Dialog open={open} onOpenChange={o => { if (!isSubmitting) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Queda habilitada {label}?</DialogTitle>
          <DialogDescription>
            {description ??
              'La limpieza se marca como terminada igual. Esto es para que recepción sepa si puede entrar alguien.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHold(false)}
              className={cn(
                'flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-colors',
                !hold
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <CheckCircle2
                className={cn('w-5 h-5 shrink-0', !hold ? 'text-emerald-600' : 'text-muted-foreground')}
              />
              <div>
                <p className="text-sm font-semibold">Sí, habilitada</p>
                <p className="text-xs text-muted-foreground">Lista para recibir</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setHold(true)}
              className={cn(
                'flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-colors',
                hold
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <Ban className={cn('w-5 h-5 shrink-0', hold ? 'text-rose-600' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold">No la habilito</p>
                <p className="text-xs text-muted-foreground">Falta o pasa algo</p>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="handover-note">
              {noteRequired ? 'Qué pasa (obligatorio)' : 'Nota para recepción (opcional)'}
            </Label>
            <Textarea
              id="handover-note"
              rows={3}
              placeholder={
                noteRequired
                  ? 'La ducha pierde, falta el control remoto...'
                  : 'Falta una almohada, el placard tiene poca percha...'
              }
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            {!noteRequired && (
              <p className="text-xs text-muted-foreground">
                La habitación queda habilitada igual, pero recepción va a ver el aviso antes
                de alojar a alguien.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={cn(hold && 'bg-rose-600 hover:bg-rose-700')}
          >
            {isSubmitting
              ? 'Guardando...'
              : hold
                ? confirmLabels?.hold ?? 'Terminar sin habilitar'
                : confirmLabels?.enable ?? 'Terminar y habilitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
