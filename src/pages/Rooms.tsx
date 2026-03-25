import { useState, useMemo, useCallback } from 'react';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useAppRole } from '@/context/AppRoleContext';
import { Room, RoomStatus } from '@/types/hotel';
import {
  RoomsHeader,
  RoomsFilters,
  RoomGrid,
  RoomDetailsDrawer
} from '@/components/rooms';
import { AddRoomDialog } from '@/components/rooms/AddRoomDialog';
import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { BedDouble, CheckSquare, X, Sparkles, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Rooms() {
  const { currentRole } = useAppRole();
  const canAddRoom = currentRole === 'admin';
  const { rooms, roomTypes, updateRoomStatus } = useRoomOperations();
  const { guests } = useGuestOperations();
  const { bookings } = useBookingOperations();

  // UI State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<Room | undefined>(undefined);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Derived Data
  const floors = useMemo(() => Array.from(new Set(rooms.map(r => r.floor.toString()))).sort(), [rooms]);

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

  // Handlers
  const handleQuickAction = useCallback((room: Room, action: 'clean' | 'occupy') => {
    if (action === 'clean') updateRoomStatus(room.id, 'AVAILABLE');
    if (action === 'occupy') updateRoomStatus(room.id, 'OCCUPIED');
  }, [updateRoomStatus]);

  const handleStatusChange = (newStatus: RoomStatus, notes?: string) => {
    if (selectedRoom) {
      updateRoomStatus(selectedRoom.id, newStatus, notes);
      setSelectedRoom({ ...selectedRoom, status: newStatus, notes });
    }
  };

  const getSelectedGuest = () => {
    if (!selectedRoom) return undefined;
    const activeBooking = bookings.find(b => b.roomId === selectedRoom.id && b.status === 'CHECKED_IN');
    return activeBooking ? guests.find(g => g.id === activeBooking.guestId) : undefined;
  };

  const getSelectedRoomTypeName = () => {
    if (!selectedRoom) return undefined;
    return roomTypes.find(rt => rt.id === selectedRoom.roomTypeId)?.name;
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
    for (const id of selectedIds) {
      await updateRoomStatus(id, newStatus);
    }
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, updateRoomStatus]);

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
          onAddRoom={canAddRoom ? () => setIsAddRoomOpen(true) : undefined}
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
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => handleBulkAction('AVAILABLE')}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Marcar Limpias
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => handleBulkAction('DIRTY')}>
            <PaintBucket className="w-3.5 h-3.5 mr-1.5" /> Marcar Sucias
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => handleBulkAction('MAINTENANCE')}>
            Mantenimiento
          </Button>
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
              description="Intenta cambiar los filtros de piso o estado"
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
          />
        )}
      </div>

      <AddRoomDialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} />

      <RoomDetailsDrawer
        isOpen={!!selectedRoom}
        onClose={() => setSelectedRoom(undefined)}
        room={selectedRoom}
        guest={getSelectedGuest()}
        roomTypeName={getSelectedRoomTypeName()}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
