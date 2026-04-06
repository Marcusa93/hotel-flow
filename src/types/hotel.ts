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
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
export type AuditEntityType = 'booking' | 'guest' | 'room' | 'payment' | 'invoice' | 'housekeeping_task' | 'rate' | 'expense' | 'hotel_settings' | 'booking_charge';

export type ChargeCategory =
  | 'MINIBAR' | 'LAVANDERIA' | 'ESTACIONAMIENTO' | 'ROOM_SERVICE'
  | 'RESTAURANT' | 'SPA' | 'TELEFONO' | 'DANO' | 'OTRO';

export interface BookingCharge {
  id: string;
  bookingId: string;
  category: ChargeCategory;
  description: string;
  amount: number;
  quantity: number;
  createdAt: Date;
  createdBy?: string;
}

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

export type DocumentType = 'DNI' | 'PASAPORTE' | 'CEDULA' | 'CUIT' | 'OTRO';

export interface Guest {
  id: string;
  fullName: string;
  documentType?: DocumentType;
  documentId?: string;
  phone: string;
  email: string;
  notes?: string;
  country?: string;
  hasVehicle?: boolean;
  vehicleDescription?: string;
  licensePlate?: string;
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
  hasVehicle?: boolean;
  vehicleDescription?: string;
  licensePlate?: string;
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
  paymentMethods?: string[];
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

/** @deprecated Notification email/whatsapp settings removed — no external sender backend exists */
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

export interface HotelSettings {
  id: string;
  hotelName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  currency: string;
  timezone: string;
  checkInTime?: string;   // e.g. "14:00"
  checkOutTime?: string;  // e.g. "11:00"
  notificationEmailEnabled: boolean;
  notificationWhatsappEnabled: boolean;
  notificationSendOnBooking: boolean;
  notificationSendOnPayment: boolean;
  notificationSendOnCheckIn: boolean;
  notificationSendOnCheckOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  description: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  ipAddress?: string;
}
