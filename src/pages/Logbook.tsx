import { useMemo, useState } from 'react';
import { NotebookPen, Plus, Search, X } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/shared';
import { LogbookEntryCard, LogbookEntryDialog, type LogbookEntryFormData } from '@/components/logbook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import {
  useCreateLogbookEntry,
  useDeleteLogbookEntry,
  useLogbookEntries,
  useUpdateLogbookEntry,
} from '@/hooks/useLogbook';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { errorToast } from '@/lib/toast-utils';
import { LOGBOOK_CATEGORIES } from '@/lib/constants';
import {
  EMPTY_LOGBOOK_FILTERS,
  countPending,
  filterLogbookEntries,
  sortLogbookEntries,
  type LogbookFilters,
} from '@/lib/logbook';
import { describeRoomMovement } from '@/lib/logbook';
import type { LogbookEntry } from '@/types/hotel';

export default function Logbook() {
  const { data: entries = [], isLoading } = useLogbookEntries();
  const { rooms } = useRoomOperations();
  const { currentRole, profileName } = useAppRole();
  const { user } = useAuth();

  const createEntry = useCreateLogbookEntry();
  const updateEntry = useUpdateLogbookEntry();
  const deleteEntry = useDeleteLogbookEntry();

  const [filters, setFilters] = useState<LogbookFilters>(EMPTY_LOGBOOK_FILTERS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogbookEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LogbookEntry | null>(null);

  // Los tres roles operativos anotan y resuelven; el auditor solo mira.
  const canWrite = currentRole === 'admin' || currentRole === 'reception' || currentRole === 'housekeeping';
  const canDelete = currentRole === 'admin';
  const author = { id: user?.id, name: profileName || user?.email || undefined };

  const roomNumberById = useMemo(
    () => Object.fromEntries(rooms.map(r => [r.id, r.roomNumber])),
    [rooms]
  );

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)),
    [rooms]
  );

  const visibleEntries = useMemo(
    () => sortLogbookEntries(filterLogbookEntries(entries, filters, roomNumberById)),
    [entries, filters, roomNumberById]
  );

  const pendingCount = countPending(entries);
  const hasActiveFilters =
    filters.category !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.roomId !== 'ALL' ||
    filters.search.trim() !== '';

  const handleSubmit = async (data: LogbookEntryFormData) => {
    const roomLabel = describeRoomMovement(
      data.roomFromId ? roomNumberById[data.roomFromId] : undefined,
      data.roomToId ? roomNumberById[data.roomToId] : undefined
    );

    try {
      if (editingEntry) {
        await updateEntry.mutateAsync({
          id: editingEntry.id,
          date: data.date,
          category: data.category,
          note: data.note,
          roomFromId: data.roomFromId ?? null,
          roomToId: data.roomToId ?? null,
          // Destildar "pendiente" en una resuelta la deja como anotación, que es
          // lo que queda cuando ya no hay nada que hacer ni que resolver.
          status: data.isPending ? 'PENDING' : editingEntry.status === 'PENDING' ? 'INFO' : editingEntry.status,
        });
        toast({ title: '✅ Novedad actualizada' });
      } else {
        await createEntry.mutateAsync({
          date: data.date,
          category: data.category,
          note: data.note,
          roomFromId: data.roomFromId,
          roomToId: data.roomToId,
          status: data.isPending ? 'PENDING' : 'INFO',
          createdBy: author.id,
          createdByName: author.name,
          roomLabel: roomLabel ?? undefined,
        });
        toast({
          title: '📋 Novedad anotada',
          description: data.isPending ? 'Queda pendiente hasta que alguien la resuelva' : undefined,
        });
      }
      setEditingEntry(null);
    } catch (error) {
      errorToast({
        title: 'No se pudo guardar la novedad',
        description: error instanceof Error ? error.message : 'Revisá tu conexión e intentá de nuevo.',
      });
      throw error;
    }
  };

  const handleResolve = async (entry: LogbookEntry) => {
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        status: 'RESOLVED',
        resolvedBy: author.id,
        resolvedByName: author.name,
      });
      toast({ title: '✅ Novedad resuelta' });
    } catch (error) {
      errorToast({
        title: 'No se pudo resolver',
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      });
    }
  };

  const handleReopen = async (entry: LogbookEntry) => {
    try {
      await updateEntry.mutateAsync({ id: entry.id, status: 'PENDING' });
      toast({ title: 'Novedad reabierta' });
    } catch (error) {
      errorToast({
        title: 'No se pudo reabrir',
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteEntry.mutateAsync(pendingDelete);
      toast({ title: 'Novedad eliminada' });
    } catch (error) {
      errorToast({
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const openNew = () => {
    setEditingEntry(null);
    setIsDialogOpen(true);
  };

  const openEdit = (entry: LogbookEntry) => {
    setEditingEntry(entry);
    setIsDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Novedades"
        description={
          pendingCount > 0
            ? `${entries.length} anotaciones · ${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`
            : `${entries.length} anotaciones`
        }
        actions={
          canWrite ? (
            <Button onClick={openNew} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Anotar novedad
            </Button>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en las novedades..."
            className="pl-9"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>

        <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendientes</SelectItem>
            <SelectItem value="INFO">Anotaciones</SelectItem>
            <SelectItem value="RESOLVED">Resueltas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {LOGBOOK_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.roomId} onValueChange={v => setFilters(f => ({ ...f, roomId: v }))}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Habitación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las hab.</SelectItem>
            {sortedRooms.map(room => (
              <SelectItem key={room.id} value={room.id}>Hab. {room.roomNumber}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFilters(EMPTY_LOGBOOK_FILTERS)}
            aria-label="Limpiar filtros"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={hasActiveFilters ? 'No hay novedades con esos filtros' : 'Todavía no hay novedades'}
          description={
            hasActiveFilters
              ? 'Probá con otros filtros o limpiá la búsqueda.'
              : 'Acá se anota lo que pasa puertas adentro: una toalla que salió de una habitación, una bebida que se movió, algo que falta.'
          }
          action={
            hasActiveFilters
              ? { label: 'Limpiar filtros', onClick: () => setFilters(EMPTY_LOGBOOK_FILTERS) }
              : canWrite
                ? { label: 'Anotar la primera', onClick: openNew }
                : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {visibleEntries.map(entry => (
            <LogbookEntryCard
              key={entry.id}
              entry={entry}
              roomNumberById={roomNumberById}
              canEdit={canWrite}
              canDelete={canDelete}
              onResolve={handleResolve}
              onReopen={handleReopen}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <LogbookEntryDialog
        open={isDialogOpen}
        onOpenChange={open => {
          setIsDialogOpen(open);
          if (!open) setEditingEntry(null);
        }}
        rooms={rooms}
        entry={editingEntry}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={open => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra de la planilla y no se puede recuperar. Queda registrado en la auditoría
              que la eliminaste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
