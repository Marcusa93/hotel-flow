
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  RoomType,
  Room,
  Guest,
  Booking,
  Payment,
  HousekeepingTask,
  Rate,
  NotificationLog,
  NotificationSettings,
  UserRole,
  DashboardStats,
  OccupancyByType,
  RoomWithDetails,
  BookingWithDetails,
  RoomStatus,
  BookingStatus,
  PaymentStatus,
  HousekeepingStatus,
} from '@/types/hotel';
import {
  initialRoomTypes,
  initialRooms,
  initialGuests,
  initialBookings,
  initialPayments,
  initialHousekeepingTasks,
  initialRates,
  initialNotificationLogs,
} from '@/data/mockData';
import { useRoomTypes } from '@/hooks/useRoomTypes';
import { useRooms } from '@/hooks/useRooms';
import { useGuests } from '@/hooks/useGuests';
import { useBookings } from '@/hooks/useBookings';
import { usePayments } from '@/hooks/usePayments';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import { useCreateBooking } from '@/hooks/useCreateBooking';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { useCreateGuest } from '@/hooks/useCreateGuest';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useUpdatePayment } from '@/hooks/useUpdatePayment';
import { useCreateHousekeepingTask } from '@/hooks/useCreateHousekeepingTask';
import { useUpdateHousekeepingTask } from '@/hooks/useUpdateHousekeepingTask';

interface HotelContextType {
  // Data
  roomTypes: RoomType[];
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  payments: Payment[];
  housekeepingTasks: HousekeepingTask[];
  rates: Rate[];
  notificationLogs: NotificationLog[];
  notificationSettings: NotificationSettings;
  currentRole: UserRole;
  isLoading: boolean;

  // Computed
  getRoomWithDetails: (roomId: string) => RoomWithDetails | undefined;
  getBookingWithDetails: (bookingId: string) => BookingWithDetails | undefined;
  getDashboardStats: () => DashboardStats;
  getOccupancyByType: () => OccupancyByType[];
  getBookingsForDate: (date: Date) => Booking[];
  getBookingsForRoom: (roomId: string) => Booking[];
  checkRoomAvailability: (roomId: string, checkIn: Date, checkOut: Date, excludeBookingId?: string) => { available: boolean; conflicts: Booking[] };

  // Actions
  setCurrentRole: (role: UserRole) => void;
  addGuest: (guest: Omit<Guest, 'id' | 'createdAt'>) => Promise<Guest>;
  updateGuest: (id: string, data: Partial<Guest>) => Promise<void>;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<Payment>;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;
  updateRoomStatus: (id: string, status: RoomStatus, notes?: string) => Promise<void>;
  updateHousekeepingTask: (id: string, data: Partial<HousekeepingTask>) => Promise<void>;
  addHousekeepingTask: (task: Omit<HousekeepingTask, 'id'>) => Promise<HousekeepingTask>;
  addRate: (rate: Omit<Rate, 'id'>) => Rate;
  updateRate: (id: string, data: Partial<Rate>) => void;
  deleteRate: (id: string) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  // Fetch Real Data
  const { data: fetchedRoomTypes, isLoading: isLoadingRoomTypes } = useRoomTypes();
  const { data: fetchedRooms, isLoading: isLoadingRooms } = useRooms();
  const { data: fetchedGuests, isLoading: isLoadingGuests } = useGuests();
  const { data: fetchedBookings, isLoading: isLoadingBookings } = useBookings();
  const { data: fetchedPayments, isLoading: isLoadingPayments } = usePayments();

  // Mutations
  const updateRoomMutation = useUpdateRoom();
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
  const createGuestMutation = useCreateGuest();
  const updateGuestMutation = useUpdateGuest();
  const createPaymentMutation = useCreatePayment();
  const updatePaymentMutation = useUpdatePayment();
  const createHousekeepingTaskMutation = useCreateHousekeepingTask();
  const updateHousekeepingTaskMutation = useUpdateHousekeepingTask();

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [notificationLogs] = useState<NotificationLog[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    whatsappEnabled: false,
    sendOnBooking: true,
    sendOnPayment: true,
    sendOnCheckIn: true,
    sendOnCheckOut: false,
  });

  // Sync Fetched Data
  useEffect(() => {
    if (fetchedRoomTypes) {
      setRoomTypes(fetchedRoomTypes);
    }
  }, [fetchedRoomTypes]);

  useEffect(() => {
    if (fetchedRooms) {
      setRooms(fetchedRooms);
    }
  }, [fetchedRooms]);

  useEffect(() => {
    if (fetchedGuests) {
      setGuests(fetchedGuests);
    }
  }, [fetchedGuests]);

  useEffect(() => {
    if (fetchedBookings) {
      setBookings(fetchedBookings);
    }
  }, [fetchedBookings]);

  useEffect(() => {
    if (fetchedPayments) {
      setPayments(fetchedPayments);
    }
  }, [fetchedPayments]);

  // Helper to generate IDs
  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get room with all details
  const getRoomWithDetails = useCallback((roomId: string): RoomWithDetails | undefined => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return undefined;

    const roomType = roomTypes.find(rt => rt.id === room.roomTypeId)!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentBooking = bookings.find(b =>
      b.roomId === roomId &&
      b.status === 'CHECKED_IN' &&
      new Date(b.checkInDate) <= today &&
      new Date(b.checkOutDate) >= today
    );

    const currentGuest = currentBooking ? guests.find(g => g.id === currentBooking.guestId) : undefined;

    return { ...room, roomType, currentBooking, currentGuest };
  }, [rooms, roomTypes, bookings, guests]);

  // Get booking with all details
  const getBookingWithDetails = useCallback((bookingId: string): BookingWithDetails | undefined => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return undefined;

    const guest = guests.find(g => g.id === booking.guestId)!;
    const room = rooms.find(r => r.id === booking.roomId)!;
    const roomType = roomTypes.find(rt => rt.id === room.roomTypeId)!;
    const bookingPayments = payments.filter(p => p.bookingId === bookingId);

    return { ...booking, guest, room, roomType, payments: bookingPayments };
  }, [bookings, guests, rooms, roomTypes, payments]);

  // Dashboard stats
  const getDashboardStats = useCallback((): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
    const availableRooms = rooms.filter(r => r.status === 'AVAILABLE').length;
    const dirtyRooms = rooms.filter(r => r.status === 'DIRTY').length;
    const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER').length;

    const checkInsToday = bookings.filter(b => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      return checkIn.getTime() === today.getTime() && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
    }).length;

    const checkOutsToday = bookings.filter(b => {
      const checkOut = new Date(b.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      return checkOut.getTime() === today.getTime() && b.status === 'CHECKED_IN';
    }).length;

    const upcomingBookings7Days = bookings.filter(b => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      return checkIn > today && checkIn <= sevenDaysLater && (b.status === 'CONFIRMED' || b.status === 'PENDING');
    }).length;

    const monthlyRevenue = payments
      .filter(p => new Date(p.date) >= startOfMonth && p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = payments
      .filter(p => p.status === 'PENDING')
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

  // Occupancy by room type
  const getOccupancyByType = useCallback((): OccupancyByType[] => {
    return roomTypes.map(rt => {
      const typeRooms = rooms.filter(r => r.roomTypeId === rt.id);
      const occupied = typeRooms.filter(r => r.status === 'OCCUPIED').length;
      return {
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        total: typeRooms.length,
        occupied,
        rate: typeRooms.length > 0 ? (occupied / typeRooms.length) * 100 : 0,
      };
    });
  }, [roomTypes, rooms]);

  // Get bookings for a specific date
  const getBookingsForDate = useCallback((date: Date): Booking[] => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return bookings.filter(b => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);

      return checkIn <= targetDate && checkOut >= targetDate && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW';
    });
  }, [bookings]);

  // Get bookings for a specific room
  const getBookingsForRoom = useCallback((roomId: string): Booking[] => {
    return bookings.filter(b => b.roomId === roomId && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');
  }, [bookings]);

  // Check room availability
  const checkRoomAvailability = useCallback((
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): { available: boolean; conflicts: Booking[] } => {
    const conflicts = bookings.filter(b => {
      if (b.roomId !== roomId) return false;
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW' || b.status === 'CHECKED_OUT') return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;

      const bCheckIn = new Date(b.checkInDate);
      const bCheckOut = new Date(b.checkOutDate);
      const newCheckIn = new Date(checkIn);
      const newCheckOut = new Date(checkOut);

      // Check for overlap
      return newCheckIn < bCheckOut && newCheckOut > bCheckIn;
    });

    return { available: conflicts.length === 0, conflicts };
  }, [bookings]);

  // Guest actions
  const addGuest = useCallback(async (guestData: Omit<Guest, 'id' | 'createdAt'>): Promise<Guest> => {
    return await createGuestMutation.mutateAsync(guestData);
  }, [createGuestMutation]);

  const updateGuest = useCallback(async (id: string, data: Partial<Guest>) => {
    await updateGuestMutation.mutateAsync({ id, data });
  }, [updateGuestMutation]);

  // Booking actions
  const addBooking = useCallback(async (bookingData: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
    return await createBookingMutation.mutateAsync(bookingData);
  }, [createBookingMutation]);

  const updateBooking = useCallback(async (id: string, data: Partial<Booking>) => {
    // Only status update is fully implemented in hooks for now, but we can expand
    if (data.status) {
      await updateBookingMutation.mutateAsync({ id, status: data.status });
    }
  }, [updateBookingMutation]);

  const updateBookingStatus = useCallback(async (id: string, status: BookingStatus) => {
    await updateBookingMutation.mutateAsync({ id, status });

    // Side effects logic (restored for persistence)
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      if (status === 'CHECKED_IN') {
        await updateRoomMutation.mutateAsync({ id: booking.roomId, status: 'OCCUPIED' });
      } else if (status === 'CHECKED_OUT') {
        await updateRoomMutation.mutateAsync({ id: booking.roomId, status: 'DIRTY' });

        // Create housekeeping task
        await createHousekeepingTaskMutation.mutateAsync({
          roomId: booking.roomId,
          date: new Date(),
          status: 'TODO',
          notes: 'Check-out - Limpieza requerida'
        });
      }
    }
  }, [updateBookingMutation, bookings, updateRoomMutation, createHousekeepingTaskMutation]);

  // Payment actions
  const addPayment = useCallback(async (paymentData: Omit<Payment, 'id'>): Promise<Payment> => {
    const newPayment = await createPaymentMutation.mutateAsync(paymentData);
    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  }, [createPaymentMutation]);

  const updatePayment = useCallback(async (id: string, data: Partial<Payment>) => {
    await updatePaymentMutation.mutateAsync({ id, data });
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [updatePaymentMutation]);

  // Room actions
  const updateRoomStatus = useCallback(async (id: string, status: RoomStatus, notes?: string) => {
    await updateRoomMutation.mutateAsync({ id, status, notes });
  }, [updateRoomMutation]);

  // Housekeeping actions
  const updateHousekeepingTask = useCallback(async (id: string, data: Partial<HousekeepingTask>) => {
    await updateHousekeepingTaskMutation.mutateAsync({ id, data });

    // Side effect: update room status if task is DONE
    if (data.status === 'DONE') {
      const task = housekeepingTasks.find(t => t.id === id);
      if (task) {
        const room = rooms.find(r => r.id === task.roomId);
        if (room && room.status === 'DIRTY') {
          await updateRoomMutation.mutateAsync({ id: task.roomId, status: 'AVAILABLE' });
        }
      }
    }
  }, [updateHousekeepingTaskMutation, housekeepingTasks, rooms, updateRoomMutation]);

  const addHousekeepingTask = useCallback(async (taskData: Omit<HousekeepingTask, 'id'>): Promise<HousekeepingTask> => {
    return await createHousekeepingTaskMutation.mutateAsync(taskData);
  }, [createHousekeepingTaskMutation]);

  // Rate actions
  const addRate = useCallback((rateData: Omit<Rate, 'id'>): Rate => {
    const newRate: Rate = {
      ...rateData,
      id: generateId('rate'),
    };
    setRates(prev => [...prev, newRate]);
    return newRate;
  }, []);

  const updateRate = useCallback((id: string, data: Partial<Rate>) => {
    setRates(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  }, []);

  const deleteRate = useCallback((id: string) => {
    setRates(prev => prev.filter(r => r.id !== id));
  }, []);

  // Notification settings
  const updateNotificationSettings = useCallback((settings: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const value = useMemo(() => ({
    roomTypes,
    rooms,
    guests,
    bookings,
    payments,
    housekeepingTasks,
    rates,
    notificationLogs,
    notificationSettings,
    currentRole,
    isLoading: isLoadingRooms || isLoadingRoomTypes || isLoadingGuests || isLoadingBookings,
    getRoomWithDetails,
    getBookingWithDetails,
    getDashboardStats,
    getOccupancyByType,
    getBookingsForDate,
    getBookingsForRoom,
    checkRoomAvailability,
    setCurrentRole,
    addGuest,
    updateGuest,
    addBooking,
    updateBooking,
    updateBookingStatus,
    addPayment,
    updatePayment,
    updateRoomStatus,
    updateHousekeepingTask,
    addHousekeepingTask,
    addRate,
    updateRate,
    deleteRate,
    updateNotificationSettings,
  }), [
    roomTypes, rooms, guests, bookings, payments, housekeepingTasks, rates,
    notificationLogs, notificationSettings, currentRole, isLoadingRooms, isLoadingRoomTypes, isLoadingGuests, isLoadingBookings,
    getRoomWithDetails, getBookingWithDetails, getDashboardStats, getOccupancyByType,
    getBookingsForDate, getBookingsForRoom, checkRoomAvailability,
    addGuest, updateGuest, addBooking, updateBooking, updateBookingStatus,
    addPayment, updatePayment, updateRoomStatus, updateHousekeepingTask,
    addHousekeepingTask, addRate, updateRate, deleteRate, updateNotificationSettings,
  ]);

  return (
    <HotelContext.Provider value={value}>
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const context = useContext(HotelContext);
  if (context === undefined) {
    throw new Error('useHotel must be used within a HotelProvider');
  }
  return context;
}
