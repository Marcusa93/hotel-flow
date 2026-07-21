import { useMemo, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Room, TaskPriority } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StaffCombobox, AssignmentHint } from './StaffCombobox';
import { useHousekeepingStaff, findStaffByName } from '@/hooks/useHousekeepingStaff';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateTaskDialogProps {
  rooms: Room[];
  staffSuggestions?: string[];
  onCreateTask: (data: {
    roomId: string;
    priority: TaskPriority;
    assignedTo?: string;
    /** profiles.id cuando la persona asignada tiene usuario en la app */
    assignedToUserId?: string;
    roomNumber?: string;
    notes?: string;
  }) => Promise<void>;
  isCreating?: boolean;
}

const priorityOptions: { value: TaskPriority; label: string; description: string }[] = [
  { value: 'LOW', label: 'Baja', description: 'Sin urgencia' },
  { value: 'NORMAL', label: 'Normal', description: 'Limpieza estándar' },
  { value: 'URGENT', label: 'Urgente', description: 'Atención inmediata' },
  { value: 'CHECKOUT', label: 'Checkout', description: 'Post checkout' },
];

export function CreateTaskDialog({ rooms, staffSuggestions = [], onCreateTask, isCreating }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  const { data: staff = [] } = useHousekeepingStaff();
  const assignee = findStaffByName(staff, assignedTo);
  // Los nombres del personal con usuario van primero: son los que reciben aviso.
  const suggestions = useMemo(
    () => Array.from(new Set([...staff.map(s => s.name), ...staffSuggestions])),
    [staff, staffSuggestions]
  );

  // Only show rooms that could need cleaning (DIRTY, OCCUPIED, AVAILABLE)
  const availableRooms = [...rooms].sort((a, b) => {
    // DIRTY rooms first
    const statusOrder: Record<string, number> = { DIRTY: 0, OCCUPIED: 1, AVAILABLE: 2, MAINTENANCE: 3 };
    const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (diff !== 0) return diff;
    return a.roomNumber.localeCompare(b.roomNumber);
  });

  const handleSubmit = async () => {
    if (!roomId) return;
    try {
      await onCreateTask({
        roomId,
        priority,
        assignedTo: assignedTo.trim() || undefined,
        assignedToUserId: assignee?.id,
        roomNumber: rooms.find(r => r.id === roomId)?.roomNumber,
        notes: notes || undefined,
      });
      // Reset form
      setRoomId('');
      setPriority('NORMAL');
      setAssignedTo('');
      setNotes('');
      setOpen(false);
    } catch {
      // Error handled by parent
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DIRTY: '🔴 Sucia',
      OCCUPIED: '🔵 Ocupada',
      AVAILABLE: '🟢 Disponible',
      MAINTENANCE: '🟡 Mantenimiento',
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Crear Tarea de Limpieza</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Room Selection */}
          <div className="space-y-2">
            <Label htmlFor="room">Habitación *</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="room">
                <SelectValue placeholder="Seleccionar habitación" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableRooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">Hab. {room.roomNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        Piso {room.floor} · {statusLabel(room.status)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Asignar a</Label>
            <StaffCombobox
              value={assignedTo}
              onChange={setAssignedTo}
              suggestions={suggestions}
            />
            <AssignmentHint assigneeName={assignee?.name} typedName={assignedTo} hasStaff={staff.length > 0} />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Instrucciones adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!roomId || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Crear Tarea
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
