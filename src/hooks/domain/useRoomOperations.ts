import { useCallback, useMemo } from 'react';
import { useRooms } from '@/hooks/useRooms';
import { useRoomTypes } from '@/hooks/useRoomTypes';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import type {
  Room,
  RoomType,
  RoomStatus,
  RoomWithDetails,
  Booking,
  Guest,
} from '@/types/hotel';

export function useRoomOperations() {
  const { data: rooms = [], isLoading: isLoadingRooms } = useRooms();
  const { data: roomTypes = [], isLoading: isLoadingRoomTypes } = useRoomTypes();
  const updateRoomMutation = useUpdateRoom();

  const isLoading = isLoadingRooms || isLoadingRoomTypes;

  const getRoomWithDetails = useCallback(
    (roomId: string, bookings: Booking[], guests: Guest[]): RoomWithDetails | undefined => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return undefined;

      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId)!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentBooking = bookings.find(
        (b) =>
          b.roomId === roomId &&
          b.status === 'CHECKED_IN' &&
          new Date(b.checkInDate) <= today &&
          new Date(b.checkOutDate) >= today
      );

      const currentGuest = currentBooking
        ? guests.find((g) => g.id === currentBooking.guestId)
        : undefined;

      return { ...room, roomType, currentBooking, currentGuest };
    },
    [rooms, roomTypes]
  );

  const updateRoomStatus = useCallback(
    async (id: string, status: RoomStatus, notes?: string) => {
      await updateRoomMutation.mutateAsync({ id, status, notes });
    },
    [updateRoomMutation]
  );

  const getRoomType = useCallback(
    (roomTypeId: string): RoomType | undefined => {
      return roomTypes.find((rt) => rt.id === roomTypeId);
    },
    [roomTypes]
  );

  const roomsByFloor = useMemo(() => {
    const floors = new Set(rooms.map((r) => r.floor));
    return Array.from(floors)
      .sort()
      .map((floor) => ({
        floor,
        rooms: rooms.filter((r) => r.floor === floor),
      }));
  }, [rooms]);

  return {
    rooms,
    roomTypes,
    isLoading,
    getRoomWithDetails,
    updateRoomStatus,
    getRoomType,
    roomsByFloor,
    isUpdating: updateRoomMutation.isPending,
  };
}
