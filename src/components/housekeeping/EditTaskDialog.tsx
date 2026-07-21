import { useState, useEffect, useMemo } from 'react';
import { Pencil, Loader2, Save } from 'lucide-react';
import { Room, TaskPriority, HousekeepingTask, HousekeepingStatus } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { StaffCombobox, AssignmentHint } from './StaffCombobox';
import { useHousekeepingStaff, findStaffByName } from '@/hooks/useHousekeepingStaff';
import { notifyRoomAssignment } from '@/lib/housekeepingNotify';

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: HousekeepingTask;
  room: Room;
  rooms: Room[];
  staffSuggestions: string[];
  onSave: (taskId: string, data: Partial<HousekeepingTask>) => Promise<void>;
  isUpdating?: boolean;
}

const priorityOptions: { value: TaskPriority; label: string; description: string }[] = [
  { value: 'LOW', label: 'Baja', description: 'Sin urgencia' },
  { value: 'NORMAL', label: 'Normal', description: 'Limpieza estándar' },
  { value: 'URGENT', label: 'Urgente', description: 'Atención inmediata' },
  { value: 'CHECKOUT', label: 'Checkout', description: 'Post checkout' },
];

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  room,
  rooms,
  staffSuggestions,
  onSave,
  isUpdating,
}: EditTaskDialogProps) {
  const [priority, setPriority] = useState<TaskPriority>(task.priority || 'NORMAL');
  const [assignedTo, setAssignedTo] = useState(task.assignedTo || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [roomId, setRoomId] = useState(task.roomId);

  const { data: staff = [] } = useHousekeepingStaff();
  const assignee = findStaffByName(staff, assignedTo);
  const suggestions = useMemo(
    () => Array.from(new Set([...staff.map(s => s.name), ...staffSuggestions])),
    [staff, staffSuggestions]
  );

  // Reset form when task changes
  useEffect(() => {
    if (open) {
      setPriority(task.priority || 'NORMAL');
      setAssignedTo(task.assignedTo || '');
      setNotes(task.notes || '');
      setRoomId(task.roomId);
    }
  }, [open, task]);

  const availableRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const statusOrder: Record<string, number> = { DIRTY: 0, OCCUPIED: 1, AVAILABLE: 2, MAINTENANCE: 3 };
      const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (diff !== 0) return diff;
      return a.roomNumber.localeCompare(b.roomNumber);
    });
  }, [rooms]);

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DIRTY: '🔴 Sucia',
      OCCUPIED: '🔵 Ocupada',
      AVAILABLE: '🟢 Disponible',
      MAINTENANCE: '🟡 Mantenimiento',
    };
    return labels[status] || status;
  };

  const hasChanges =
    priority !== (task.priority || 'NORMAL') ||
    assignedTo !== (task.assignedTo || '') ||
    notes !== (task.notes || '') ||
    roomId !== task.roomId;

  const handleSave = async () => {
    const updates: Partial<HousekeepingTask> = {};
    if (priority !== (task.priority || 'NORMAL')) updates.priority = priority;
    if (assignedTo !== (task.assignedTo || '')) updates.assignedTo = assignedTo.trim() || undefined;
    if (notes !== (task.notes || '')) updates.notes = notes || undefined;
    if (roomId !== task.roomId) updates.roomId = roomId;

    const assignmentChanged = updates.assignedTo !== undefined || roomId !== task.roomId;

    try {
      await onSave(task.id, updates);

      // Recién asignada (o movida de habitación): la persona tiene que enterarse.
      if (assignee && assignmentChanged) {
        const targetRoom = rooms.find(r => r.id === roomId) || room;
        void notifyRoomAssignment({
          userId: assignee.id,
          roomNumber: targetRoom?.roomNumber,
          roomId,
          taskId: task.id,
          reason: priority === 'CHECKOUT'
            ? 'Check-out: la habitación quedó libre'
            : priority === 'URGENT'
              ? 'Urgente — te asignaron esta habitación'
              : 'Te asignaron esta habitación',
        });
      }

      onOpenChange(false);
    } catch {
      // Error handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Editar Tarea — Hab. {room.roomNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Room Selection */}
          <div className="space-y-2">
            <Label>Habitación</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">Hab. {r.roomNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        Piso {r.floor} · {statusLabel(r.status)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger>
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

          {/* Assigned To with autocomplete */}
          <div className="space-y-2">
            <Label>Asignar a</Label>
            <StaffCombobox
              value={assignedTo}
              onChange={setAssignedTo}
              suggestions={suggestions}
            />
            <AssignmentHint assigneeName={assignee?.name} typedName={assignedTo} hasStaff={staff.length > 0} />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
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
          <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
