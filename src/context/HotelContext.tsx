import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
  addGuest: (guest: Omit<Guest, 'id' | 'createdAt'>) => Guest;
  updateGuest: (id: string, data: Partial<Guest>) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  updateBooking: (id: string, data: Partial<Booking>) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => Payment;
  updatePayment: (id: string, data: Partial<Payment>) => void;
  updateRoomStatus: (id: string, status: RoomStatus) => void;
  updateHousekeepingTask: (id: string, data: Partial<HousekeepingTask>) => void;
  addHousekeepingTask: (task: Omit<HousekeepingTask, 'id'>) => HousekeepingTask;
  addRate: (rate: Omit<Rate, 'id'>) => Rate;
  updateRate: (id: string, data: Partial<Rate>) => void;
  deleteRate: (id: string) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  const [roomTypes] = useState<RoomType[]>(initialRoomTypes);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>(initialHousekeepingTasks);
  const [rates, setRates] = useState<Rate[]>(initialRates);
  const [notificationLogs] = useState<NotificationLog[]>(initialNotificationLogs);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    whatsappEnabled: false,
    sendOnBooking: true,
    sendOnPayment: true,
    sendOnCheckIn: true,
    sendOnCheckOut: false,
  });

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
  const addGuest = useCallback((guestData: Omit<Guest, 'id' | 'createdAt'>): Guest => {
    const newGuest: Guest = {
      ...guestData,
      id: generateId('g'),
      createdAt: new Date(),
    };
    setGuests(prev => [...prev, newGuest]);
    return newGuest;
  }, []);

  const updateGuest = useCallback((id: string, data: Partial<Guest>) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
  }, []);

  // Booking actions
  const addBooking = useCallback((bookingData: Omit<Booking, 'id' | 'createdAt'>): Booking => {
    const newBooking: Booking = {
      ...bookingData,
      id: generateId('b'),
      createdAt: new Date(),
    };
    setBookings(prev => [...prev, newBooking]);
    return newBooking;
  }, []);

  const updateBooking = useCallback((id: string, data: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, []);

  const updateBookingStatus = useCallback((id: string, status: BookingStatus) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    
    // Update room status based on booking status
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      if (status === 'CHECKED_IN') {
        setRooms(prev => prev.map(r => r.id === booking.roomId ? { ...r, status: 'OCCUPIED' } : r));
      } else if (status === 'CHECKED_OUT') {
        setRooms(prev => prev.map(r => r.id === booking.roomId ? { ...r, status: 'DIRTY' } : r));
        // Create housekeeping task
        const newTask: HousekeepingTask = {
          id: generateId('ht'),
          roomId: booking.roomId,
          date: new Date(),
          status: 'TODO',
          notes: 'Check-out - Limpieza requerida',
        };
        setHousekeepingTasks(prev => [...prev, newTask]);
      }
    }
  }, [bookings]);

  // Payment actions
  const addPayment = useCallback((paymentData: Omit<Payment, 'id'>): Payment => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId('p'),
    };
    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  }, []);

  const updatePayment = useCallback((id: string, data: Partial<Payment>) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  // Room actions
  const updateRoomStatus = useCallback((id: string, status: RoomStatus) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }, []);

  // Housekeeping actions
  const updateHousekeepingTask = useCallback((id: string, data: Partial<HousekeepingTask>) => {
    setHousekeepingTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    
    // If task is done, update room status
    if (data.status === 'DONE') {
      const task = housekeepingTasks.find(t => t.id === id);
      if (task) {
        const room = rooms.find(r => r.id === task.roomId);
        if (room && room.status === 'DIRTY') {
          setRooms(prev => prev.map(r => r.id === task.roomId ? { ...r, status: 'AVAILABLE' } : r));
        }
      }
    }
  }, [housekeepingTasks, rooms]);

  const addHousekeepingTask = useCallback((taskData: Omit<HousekeepingTask, 'id'>): HousekeepingTask => {
    const newTask: HousekeepingTask = {
      ...taskData,
      id: generateId('ht'),
    };
    setHousekeepingTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

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
    notificationLogs, notificationSettings, currentRole,
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
