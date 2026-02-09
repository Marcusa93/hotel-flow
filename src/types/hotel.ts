// Hotel PMS Data Models

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type HousekeepingStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'URGENT' | 'CHECKOUT';
export type UserRole = 'admin' | 'reception' | 'housekeeping' | 'auditor';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type InvoiceItemType = 'ACCOMMODATION' | 'SERVICE' | 'EXTRA' | 'OTHER';

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
  country?: string;
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
  updatedAt?: Date;
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
  priority: TaskPriority;
  startedAt?: Date;
  completedAt?: Date;
  durationMinutes?: number;
  checkoutTriggered?: boolean;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface Rate {
  id: string;
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
  price: number;
  label: string;
  isActive: boolean;
  discountType?: DiscountType;
  discountPercent?: number;
  discountAmount?: number;
  minNights?: number;
  promoCode?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType: InvoiceItemType;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  guestId: string;
  issueDate: Date;
  dueDate?: Date;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  signatureData?: string;
  items?: InvoiceItem[];
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

// Expense tracking
export type ExpenseType =
  | 'PANADERIA'
  | 'SUPERMERCADO'
  | 'VERDULERIA'
  | 'CARNICERIA'
  | 'BEBIDAS'
  | 'LIMPIEZA'
  | 'MANTENIMIENTO'
  | 'SERVICIOS'
  | 'OTROS';

export interface Expense {
  id: string;
  date: Date;
  expenseType: ExpenseType;
  amount: number;
  description?: string;
  createdAt: Date;
}
