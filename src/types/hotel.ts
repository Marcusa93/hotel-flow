// Hotel PMS Data Models

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type HousekeepingStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type UserRole = 'admin' | 'reception' | 'housekeeping' | 'auditor';

export interface RoomType {
  id: string;
  name: string;
  basePrice: number;
  maxGuests: number;
  description?: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor: number;
  status: RoomStatus;
  notes?: string;
}

export interface Guest {
  id: string;
  fullName: string;
  documentId?: string;
  phone: string;
  email: string;
  notes?: string;
  createdAt: Date;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  status: BookingStatus;
  totalAmount: number;
  notes?: string;
  needsReview?: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  bookingId: string;
  date: Date;
  method: PaymentMethod;
  reference?: string;
  comment?: string;
  status: PaymentStatus;
  amount: number;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  date: Date;
  assignedTo?: string;
  status: HousekeepingStatus;
  notes?: string;
}

export interface Rate {
  id: string;
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
  price: number;
  label: string;
  isActive: boolean;
}

export interface NotificationLog {
  id: string;
  type: 'email' | 'whatsapp';
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  createdAt: Date;
  bookingId?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  sendOnBooking: boolean;
  sendOnPayment: boolean;
  sendOnCheckIn: boolean;
  sendOnCheckOut: boolean;
}

// Helper types
export interface RoomWithDetails extends Room {
  roomType: RoomType;
  currentBooking?: Booking;
  currentGuest?: Guest;
}

export interface BookingWithDetails extends Booking {
  guest: Guest;
  room: Room;
  roomType: RoomType;
  payments: Payment[];
}

export interface DashboardStats {
  occupancyRate: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  dirtyRooms: number;
  maintenanceRooms: number;
  checkInsToday: number;
  checkOutsToday: number;
  upcomingBookings7Days: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

export interface OccupancyByType {
  roomTypeId: string;
  roomTypeName: string;
  total: number;
  occupied: number;
  rate: number;
}
