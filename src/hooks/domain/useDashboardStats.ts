import { useMemo } from 'react';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useRoomTypes } from '@/hooks/useRoomTypes';
import { usePayments } from '@/hooks/usePayments';
import type { DashboardStats, OccupancyByType } from '@/types/hotel';

export function useDashboardStats() {
  const { data: rooms = [] } = useRooms();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: bookings = [] } = useBookings();
  const { data: payments = [] } = usePayments();

  const stats = useMemo((): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length;
    const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE').length;
    const dirtyRooms = rooms.filter((r) => r.status === 'DIRTY').length;
    const maintenanceRooms = rooms.filter(
      (r) => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER'
    ).length;

    const checkInsToday = bookings.filter((b) => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      return (
        checkIn.getTime() === today.getTime() &&
        (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')
      );
    }).length;

    const checkOutsToday = bookings.filter((b) => {
      const checkOut = new Date(b.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      return checkOut.getTime() === today.getTime() && b.status === 'CHECKED_IN';
    }).length;

    const upcomingBookings7Days = bookings.filter((b) => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      return (
        checkIn > today &&
        checkIn <= sevenDaysLater &&
        (b.status === 'CONFIRMED' || b.status === 'PENDING')
      );
    }).length;

    const monthlyRevenue = payments
      .filter((p) => new Date(p.date) >= startOfMonth && p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = payments
      .filter((p) => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
      totalRooms,
      occupiedRooms,
      availableRooms,
      dirtyRooms,
      maintenanceRooms,
      checkInsToday,
      checkOutsToday,
      upcomingBookings7Days,
      monthlyRevenue,
      pendingPayments,
    };
  }, [rooms, bookings, payments]);

  const occupancyByType = useMemo((): OccupancyByType[] => {
    return roomTypes.map((rt) => {
      const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id);
      const occupied = typeRooms.filter((r) => r.status === 'OCCUPIED').length;
      return {
        roomTypeId: rt.id,
        roomTypeName: `${rt.maxGuests}p`,
        total: typeRooms.length,
        occupied,
        rate: typeRooms.length > 0 ? (occupied / typeRooms.length) * 100 : 0,
      };
    });
  }, [roomTypes, rooms]);

  return {
    stats,
    occupancyByType,
  };
}
