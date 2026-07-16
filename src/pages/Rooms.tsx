import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useAppRole } from '@/context/AppRoleContext';
import { toast } from '@/hooks/use-toast';
import { Room, RoomStatus } from '@/types/hotel';

// Housekeeping may only flip between DIRTY and AVAILABLE (the outcomes
// of their own work). MAINTENANCE / OUT_OF_ORDER / OCCUPIED are
// business decisions reserved for admin + reception.
const HOUSEKEEPING_ALLOWED_STATUSES: RoomStatus[] = ['AVAILABLE', 'DIRTY'];
import {
  RoomsHeader,
  RoomsFilters,
  RoomGrid,
  RoomDetailsDrawer
} from '@/components/rooms';
// AddRoomDialog removed — rooms are fixed infrastructure
import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BedDouble, CheckSquare, X, Sparkles, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Rooms() {
  const { rooms, roomTypes, updateRoomStatus, isUpdating } = useRoomOperations();
  const { guests } = useGuestOperations();
  const { bookings } = useBookingOperations();
  const { currentRole } = useAppRole();
  const isHousekeeping = currentRole === 'housekeeping';
  const canSetAnyStatus = currentRole === 'admin' || currentRole === 'reception';

  const assertStatusAllowed = useCallback((status: RoomStatus): boolean => {
    if (canSetAnyStatus) return true;
    if (isHousekeeping && HOUSEKEEPING_ALLOWED_STATUSES.includes(status)) return true;
    toast({
      title: 'Acción no permitida',
      description: 'Tu rol no puede fijar ese estado de habitación.',
      variant: 'destructive',
    });
    return false;
  }, [canSetAnyStatus, isHousekeeping]);

  // UI State
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<Room | undefined>(undefined);

  // Accept ?status=DIRTY|MAINTENANCE|OCCUPIED|OUT_OF_ORDER|AVAILABLE from deep links.
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'DIRTY', 'MAINTENANCE', 'OUT_OF_ORDER'];
    if (statusParam && validStatuses.includes(statusParam)) {
      setStatusFilter(statusParam);
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  // isAddRoomOpen removed

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Derived Data — sort floors numerically (1, 2, ..., 10, 11)
  const floors = useMemo(
    () => Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b).map(f => f.toString()),
    [rooms]
  );

  const stats = useMemo(() => ({
    total: rooms.length,
    occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
    dirty: rooms.filter(r => r.status === 'DIRTY').length
  }), [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms
      .filter(room => {
        const matchesStatus = statusFilter === 'ALL' || room.status === statusFilter;
        const matchesFloor = floorFilter === 'ALL' || room.floor.toString() === floorFilter;
        return matchesStatus && matchesFloor;
      })
      .sort((a, b) => {
        const numA = parseInt(a.roomNumber, 10);
        const numB = parseInt(b.roomNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.roomNumber.localeCompare(b.roomNumber);
      });
  }, [rooms, statusFilter, floorFilter]);

  // Pending status change that contradicts an active check-in — needs confirmation
  const [checkInWarning, setCheckInWarning] = useState<{
    room: Room;
    status: RoomStatus;
    notes?: string;
    updateDrawer: boolean;
  } | null>(null);

  const hasActiveCheckIn = useCallback(
    (roomId: string) => bookings.some(b => b.roomId === roomId && b.status === 'CHECKED_IN'),
    [bookings]
  );

  // A status change contradicts bookings when the room has a CHECKED_IN booking
  // and we free it up (AVAILABLE/DIRTY from OCCUPIED) or re-check-in on top of it.
  const conflictsWithCheckIn = useCallback((room: Room, next: RoomStatus) => {
    if (!hasActiveCheckIn(room.id)) return false;
    if ((next === 'AVAILABLE' || next === 'DIRTY') && room.status === 'OCCUPIED') return true;
    if (next === 'OCCUPIED') return true;
    return false;
  }, [hasActiveCheckIn]);

  const performStatusUpdate = useCallback(async (
    room: Room,
    newStatus: RoomStatus,
    notes?: string,
    updateDrawer = false
  ) => {
    try {
      await updateRoomStatus(room.id, newStatus, notes);
      if (updateDrawer) {
        setSelectedRoom(prev => (prev && prev.id === room.id ? { ...prev, status: newStatus, notes } : prev));
      }
    } catch {
      toast({
        title: 'Error al actualizar',
        description: `No se pudo cambiar el estado de la habitación ${room.roomNumber}. Intentá de nuevo.`,
        variant: 'destructive',
      });
    }
  }, [updateRoomStatus]);

  // Handlers
  const handleQuickAction = useCallback(async (room: Room, action: 'clean' | 'occupy') => {
    const nextStatus: RoomStatus = action === 'clean' ? 'AVAILABLE' : 'OCCUPIED';
    if (!assertStatusAllowed(nextStatus)) return;
    if (conflictsWithCheckIn(room, nextStatus)) {
      setCheckInWarning({ room, status: nextStatus, updateDrawer: false });
      return;
    }
    await performStatusUpdate(room, nextStatus);
  }, [assertStatusAllowed, conflictsWithCheckIn, performStatusUpdate]);

  const handleStatusChange = async (newStatus: RoomStatus, notes?: string) => {
    if (!selectedRoom) return;
    if (!assertStatusAllowed(newStatus)) return;
    if (conflictsWithCheckIn(selectedRoom, newStatus)) {
      setCheckInWarning({ room: selectedRoom, status: newStatus, notes, updateDrawer: true });
      return;
    }
    await performStatusUpdate(selectedRoom, newStatus, notes, true);
  };

  const getSelectedGuest = () => {
    if (!selectedRoom) return undefined;
    const activeBooking = bookings.find(b => b.roomId === selectedRoom.id && b.status === 'CHECKED_IN');
    return activeBooking ? guests.find(g => g.id === activeBooking.guestId) : undefined;
  };

  const getSelectedRoomTypeName = () => {
    if (!selectedRoom) return undefined;
    const rt = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
    return rt ? `${rt.maxGuests} personas` : undefined;
  };

  // Bulk action handlers
  const toggleSelect = useCallback((roomId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async (newStatus: RoomStatus) => {
    if (!assertStatusAllowed(newStatus)) return;
    const ids = Array.from(selectedIds);
    try {
      let failed = 0;
      for (const id of ids) {
        try {
          await updateRoomStatus(id, newStatus);
        } catch {
          failed++;
        }
      }
      if (failed > 0) {
        toast({
          title: 'Error al actualizar',
          description: `No se pudo actualizar ${failed} de ${ids.length} habitación${ids.length > 1 ? 'es' : ''}.`,
          variant: 'destructive',
        });
      }
    } finally {
      setSelectedIds(new Set());
      setBulkMode(false);
    }
  }, [selectedIds, updateRoomStatus, assertStatusAllowed]);

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const handleRoomClick = useCallback((room: Room) => {
    if (bulkMode) {
      toggleSelect(room.id);
    } else {
      setSelectedRoom(room);
    }
  }, [bulkMode, toggleSelect]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header Section */}
      <div className="flex-none px-6 pt-6 pb-4">
        <RoomsHeader
          totalRooms={stats.total}
          occupiedCount={stats.occupied}
          dirtyCount={stats.dirty}
        />
        <div className="flex items-center justify-between gap-2">
          <RoomsFilters
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            floorFilter={floorFilter}
            onFloorFilterChange={setFloorFilter}
            floors={floors}
          />
          <Button
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
            className="shrink-0 rounded-xl h-9"
          >
            {bulkMode ? <><X className="w-4 h-4 mr-1.5" /> Cancelar</> : <><CheckSquare className="w-4 h-4 mr-1.5" /> Selección</>}
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="flex-none mx-6 mb-2 flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm font-semibold text-primary">
            {selectedIds.size} habitación{selectedIds.size > 1 ? 'es' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Limpias
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Marcar {selectedIds.size} habitación{selectedIds.size > 1 ? 'es' : ''} como limpias?</AlertDialogTitle>
                <AlertDialogDescription>Las habitaciones seleccionadas pasarán a estado Disponible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleBulkAction('AVAILABLE')}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs">
                <PaintBucket className="w-3.5 h-3.5 mr-1.5" /> Sucias
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Marcar {selectedIds.size} habitación{selectedIds.size > 1 ? 'es' : ''} como sucias?</AlertDialogTitle>
                <AlertDialogDescription>Se crearán tareas de limpieza automáticamente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleBulkAction('DIRTY')}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {canSetAnyStatus && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs">Mantenimiento</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Poner {selectedIds.size} habitación{selectedIds.size > 1 ? 'es' : ''} en mantenimiento?</AlertDialogTitle>
                  <AlertDialogDescription>Las habitaciones no estarán disponibles para reservas.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleBulkAction('MAINTENANCE')} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-2 px-6 relative">
        <div className="fixed inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10 pointer-events-none" />

        {filteredRooms.length === 0 ? (
          <div className="mt-20">
            <EmptyState
              icon={BedDouble}
              title="No se encontraron habitaciones"
              description="Ningún piso o estado coincide con los filtros actuales."
              action={
                statusFilter !== 'ALL' || floorFilter !== 'ALL'
                  ? { label: 'Limpiar filtros', onClick: () => { setStatusFilter('ALL'); setFloorFilter('ALL'); } }
                  : undefined
              }
            />
          </div>
        ) : (
          <RoomGrid
            rooms={filteredRooms}
            roomTypes={roomTypes}
            guests={guests}
            bookings={bookings}
            onRoomClick={handleRoomClick}
            onQuickAction={handleQuickAction}
            selectedIds={bulkMode ? selectedIds : undefined}
            isUpdating={isUpdating}
          />
        )}
      </div>

      {/* AddRoomDialog removed */}

      <RoomDetailsDrawer
        isOpen={!!selectedRoom}
        onClose={() => setSelectedRoom(undefined)}
        room={selectedRoom}
        guest={getSelectedGuest()}
        roomTypeName={getSelectedRoomTypeName()}
        onStatusChange={handleStatusChange}
      />

      {/* Confirmation when the change contradicts an active check-in */}
      <AlertDialog open={!!checkInWarning} onOpenChange={(open) => { if (!open) setCheckInWarning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Habitación con check-in activo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta habitación tiene un huésped con check-in activo. ¿Confirmás el cambio de estado de la habitación {checkInWarning?.room.roomNumber}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = checkInWarning;
                setCheckInWarning(null);
                if (pending) void performStatusUpdate(pending.room, pending.status, pending.notes, pending.updateDrawer);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
