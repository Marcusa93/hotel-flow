import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ArrowRight } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LOGBOOK_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { LogbookCategory, LogbookEntry, Room } from '@/types/hotel';

/** El valor del select cuando no se eligió habitación. Un SelectItem no puede
 *  tener value="" —Radix lo usa para "sin selección"— así que va un centinela. */
const SIN_HABITACION = 'NINGUNA';

export interface LogbookEntryFormData {
  date: Date;
  category: LogbookCategory;
  note: string;
  roomFromId?: string;
  roomToId?: string;
  isPending: boolean;
}

interface LogbookEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  /** Presente = editar; ausente = anotar una nueva. */
  entry?: LogbookEntry | null;
  onSubmit: (data: LogbookEntryFormData) => Promise<void>;
}

export function LogbookEntryDialog({
  open,
  onOpenChange,
  rooms,
  entry,
  onSubmit,
}: LogbookEntryDialogProps) {
  const isEditing = !!entry;

  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<LogbookCategory>('OTRO');
  const [note, setNote] = useState('');
  const [roomFromId, setRoomFromId] = useState<string>(SIN_HABITACION);
  const [roomToId, setRoomToId] = useState<string>(SIN_HABITACION);
  const [isPending, setIsPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Abrir carga lo que corresponda: la novedad que se edita, o los valores de
  // arranque. Sin esto, anotar una después de editar otra arrastra los datos
  // de la anterior.
  useEffect(() => {
    if (!open) return;
    setDate(entry ? entry.date : new Date());
    setCategory(entry?.category ?? 'OTRO');
    setNote(entry?.note ?? '');
    setRoomFromId(entry?.roomFromId ?? SIN_HABITACION);
    setRoomToId(entry?.roomToId ?? SIN_HABITACION);
    // Una resuelta que se reabre para editar no vuelve a quedar pendiente sola.
    setIsPending(entry?.status === 'PENDING');
  }, [open, entry]);

  const sortedRooms = [...rooms].sort(
    (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
  );

  const canSubmit = note.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        date,
        category,
        note: note.trim(),
        roomFromId: roomFromId === SIN_HABITACION ? undefined : roomFromId,
        roomToId: roomToId === SIN_HABITACION ? undefined : roomToId,
        isPending,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomSelect = (
    value: string,
    onValueChange: (value: string) => void,
    placeholder: string
  ) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_HABITACION}>—</SelectItem>
        {sortedRooms.map(room => (
          <SelectItem key={room.id} value={room.id}>
            {room.roomNumber}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditing ? 'Editar novedad' : 'Anotar novedad'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Los cambios quedan registrados en la auditoría.'
              : 'Queda firmada con tu nombre y la hora, para que la vea el turno que entra.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-1">
          {/* Lo que pasó */}
          <div className="space-y-2">
            <Label htmlFor="logbook-note">Qué pasó</Label>
            <Textarea
              id="logbook-note"
              autoFocus
              rows={3}
              placeholder="Se sacó una toalla, faltan almohadas, se movió una bebida..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={v => setCategory(v as LogbookCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGBOOK_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Habitaciones. Las dos opcionales: hay novedades sin ninguna. */}
          <div className="space-y-2">
            <Label>Habitación (opcional)</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">De</span>
                {roomSelect(roomFromId, setRoomFromId, '—')}
              </div>
              <ArrowRight className="w-4 h-4 mb-2.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">A</span>
                {roomSelect(roomToId, setRoomToId, '—')}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Una sola alcanza: "de la 305" para algo que salió de ahí, "a la 210" para algo que llegó.
            </p>
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Cuándo pasó</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full pl-3 text-left font-normal')}
                >
                  {format(date, 'PPP', { locale: es })}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={d => {
                    if (!d) return;
                    // El calendario devuelve medianoche. Se le pega la hora
                    // actual para no perder el orden de lo cargado en el día.
                    const now = new Date();
                    d.setHours(now.getHours(), now.getMinutes());
                    setDate(d);
                  }}
                  disabled={d => d.getTime() > Date.now() + 60_000}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Pendiente */}
          <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="logbook-pending">Queda pendiente</Label>
              <p className="text-xs text-muted-foreground">
                Activalo solo si hay algo por hacer. La novedad va a figurar arriba de todo
                hasta que alguien la resuelva.
              </p>
            </div>
            <Switch
              id="logbook-pending"
              checked={isPending}
              onCheckedChange={setIsPending}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Anotar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
