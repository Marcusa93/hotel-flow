import { useState, useMemo } from 'react';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { Room, RoomStatus } from '@/types/hotel';
import {
  RoomsHeader,
  RoomsFilters,
  RoomGrid,
  RoomDetailsDrawer
} from '@/components/rooms';
import { AddRoomDialog } from '@/components/rooms/AddRoomDialog';
import { EmptyState } from '@/components/shared';
import { BedDouble } from 'lucide-react';

export default function Rooms() {
  const { rooms, roomTypes, updateRoomStatus } = useRoomOperations();
  const { guests } = useGuestOperations();
  const { bookings } = useBookingOperations();

  // UI State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<Room | undefined>(undefined);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

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
  const handleQuickAction = (room: Room, action: 'clean' | 'occupy') => {
    if (action === 'clean') updateRoomStatus(room.id, 'AVAILABLE');
    if (action === 'occupy') updateRoomStatus(room.id, 'OCCUPIED');
  };

  const handleStatusChange = (newStatus: RoomStatus, notes?: string) => {
    if (selectedRoom) {
      updateRoomStatus(selectedRoom.id, newStatus, notes);
      // Update local selection to reflect change immediately if needed, 
      // but context update should trigger re-render of drawer if passed correctly.
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
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header Section */}
      <div className="flex-none px-6 pt-6 pb-2">
        <RoomsHeader
          totalRooms={stats.total}
          occupiedCount={stats.occupied}
          dirtyCount={stats.dirty}
          onAddRoom={() => setIsAddRoomOpen(true)}
        />
        <RoomsFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          floorFilter={floorFilter}
          onFloorFilterChange={setFloorFilter}
          floors={floors}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 px-6 relative">
        {/* Background Decoration */}
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
            onRoomClick={setSelectedRoom}
            onQuickAction={handleQuickAction}
          />
        )}
      </div>

      {/* Add Room Dialog */}
      <AddRoomDialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} />

      {/* Details Drawer */}
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
