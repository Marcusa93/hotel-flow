import { useCallback, useMemo } from 'react';
import { useBookings } from '@/hooks/useBookings';
import { useCreateBooking } from '@/hooks/useCreateBooking';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import { useCreateHousekeepingTask } from '@/hooks/useCreateHousekeepingTask';
import type {
  Booking,
  BookingStatus,
  BookingWithDetails,
  Guest,
  Room,
  RoomType,
  Payment,
} from '@/types/hotel';

export function useBookingOperations() {
  const { data: bookings = [], isLoading } = useBookings();
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
  const updateRoomMutation = useUpdateRoom();
  const createHousekeepingTaskMutation = useCreateHousekeepingTask();

  const getBookingWithDetails = useCallback(
    (
      bookingId: string,
      guests: Guest[],
      rooms: Room[],
      roomTypes: RoomType[],
      payments: Payment[]
    ): BookingWithDetails | undefined => {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return undefined;

      const guest = guests.find((g) => g.id === booking.guestId);
      const room = rooms.find((r) => r.id === booking.roomId);
      if (!guest || !room) return undefined;

      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
      if (!roomType) return undefined;

      const bookingPayments = payments.filter((p) => p.bookingId === bookingId);

      return { ...booking, guest, room, roomType, payments: bookingPayments };
    },
    [bookings]
  );

  const addBooking = useCallback(
    async (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
      return await createBookingMutation.mutateAsync(bookingData);
    },
    [createBookingMutation]
  );

  const updateBooking = useCallback(
    async (id: string, data: Partial<Booking>) => {
      if (data.status) {
        await updateBookingMutation.mutateAsync({ id, status: data.status });
      }
    },
    [updateBookingMutation]
  );

  const updateBookingStatus = useCallback(
    async (id: string, status: BookingStatus) => {
      await updateBookingMutation.mutateAsync({ id, status });

      // Side effects
      const booking = bookings.find((b) => b.id === id);
      if (booking) {
        if (status === 'CHECKED_IN') {
          await updateRoomMutation.mutateAsync({
            id: booking.roomId,
            status: 'OCCUPIED',
          });
        } else if (status === 'CHECKED_OUT') {
          await updateRoomMutation.mutateAsync({
            id: booking.roomId,
            status: 'DIRTY',
          });

          await createHousekeepingTaskMutation.mutateAsync({
            roomId: booking.roomId,
            date: new Date(),
            status: 'TODO',
            notes: 'Check-out - Limpieza requerida',
          });
        }
      }
    },
    [updateBookingMutation, bookings, updateRoomMutation, createHousekeepingTaskMutation]
  );

  const checkRoomAvailability = useCallback(
    (
      roomId: string,
      checkIn: Date,
      checkOut: Date,
      excludeBookingId?: string
    ): { available: boolean; conflicts: Booking[] } => {
      const conflicts = bookings.filter((b) => {
        if (b.roomId !== roomId) return false;
        if (
          b.status === 'CANCELLED' ||
          b.status === 'NO_SHOW' ||
          b.status === 'CHECKED_OUT'
        )
          return false;
        if (excludeBookingId && b.id === excludeBookingId) return false;

        const bCheckIn = new Date(b.checkInDate);
        const bCheckOut = new Date(b.checkOutDate);
        const newCheckIn = new Date(checkIn);
        const newCheckOut = new Date(checkOut);

        return newCheckIn < bCheckOut && newCheckOut > bCheckIn;
      });

      return { available: conflicts.length === 0, conflicts };
    },
    [bookings]
  );

  const getBookingsForDate = useCallback(
    (date: Date): Booking[] => {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      return bookings.filter((b) => {
        const checkIn = new Date(b.checkInDate);
        checkIn.setHours(0, 0, 0, 0);
        const checkOut = new Date(b.checkOutDate);
        checkOut.setHours(0, 0, 0, 0);

        return (
          checkIn <= targetDate &&
          checkOut >= targetDate &&
          b.status !== 'CANCELLED' &&
          b.status !== 'NO_SHOW'
        );
      });
    },
    [bookings]
  );

  const getBookingsForRoom = useCallback(
    (roomId: string): Booking[] => {
      return bookings.filter(
        (b) =>
          b.roomId === roomId &&
          b.status !== 'CANCELLED' &&
          b.status !== 'NO_SHOW'
      );
    },
    [bookings]
  );

  return {
    bookings,
    isLoading,
    addBooking,
    updateBooking,
    updateBookingStatus,
    getBookingWithDetails,
    checkRoomAvailability,
    getBookingsForDate,
    getBookingsForRoom,
    isCreating: createBookingMutation.isPending,
    isUpdating: updateBookingMutation.isPending,
  };
}
