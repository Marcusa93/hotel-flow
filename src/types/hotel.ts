// Hotel PMS Data Models

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CREDIT' | 'DEBIT' | 'TRANSFER' | 'QR' | 'OTHER' | 'CUENTA_CORRIENTE';

/** Los métodos con los que entra plata de verdad. Excluye la cuenta corriente. */
export type SettlementMethod = Exclude<PaymentMethod, 'CUENTA_CORRIENTE'>;
export type HousekeepingStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'URGENT' | 'CHECKOUT';
export type UserRole = 'admin' | 'reception' | 'housekeeping' | 'auditor';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type InvoiceItemType = 'ACCOMMODATION' | 'SERVICE' | 'EXTRA' | 'OTHER';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
export type AuditEntityType = 'booking' | 'guest' | 'room' | 'payment' | 'invoice' | 'housekeeping_task' | 'rate' | 'expense' | 'hotel_settings' | 'booking_charge' | 'logbook_entry';

export type ChargeCategory =
  | 'MINIBAR' | 'LAVANDERIA' | 'ESTACIONAMIENTO' | 'ROOM_SERVICE'
  | 'RESTAURANT' | 'SPA' | 'TELEFONO' | 'DANO' | 'OTRO'
  /** Noches agregadas a una reserva ya iniciada. La emite "Extender estadía". */
  | 'ALOJAMIENTO';

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

/**
 * Cómo se portó el huésped, para la interna del hotel. NULL/undefined es "sin
 * calificar": un huésped nuevo no es bueno ni malo, es desconocido.
 */
export type GuestRating = 'BUENO' | 'ATENCION' | 'NO_DESEADO';

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
  /** Habilitado a cargar sus estadías a cuenta corriente en vez de pagarlas en el momento. */
  hasCurrentAccount?: boolean;
  /** Calificación interna. Nunca sale impresa ni exportada: es para adentro. */
  rating?: GuestRating;
  /** Qué pasó. Sin esto la calificación es una etiqueta que nadie puede discutir. */
  ratingNotes?: string;
  ratingBy?: string;
  ratingAt?: Date;
  createdAt: Date;
}

/** Un pago del huésped para bajar su cuenta corriente. Los cargos no son esto. */
export interface CurrentAccountPayment {
  id: string;
  guestId: string;
  date: Date;
  amount: number;
  method: SettlementMethod;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  /** Wall-clock 'HH:MM' the guest announced they would arrive. Not the hotel's check-in policy. */
  estimatedArrivalTime?: string;
  adults: number;
  children: number;
  /**
   * Menores de 5 años. Ocupan lugar pero no se cobran: el tramo de precio sale
   * de adults + children. Ausente en reservas anteriores a la separación.
   */
  infants?: number;
  status: BookingStatus;
  totalAmount: number;
  notes?: string;
  needsReview?: boolean;
  hasVehicle?: boolean;
  vehicleDescription?: string;
  licensePlate?: string;
  receptionist?: string;
  /**
   * Promoción aplicada. Se guarda el id y además el nombre y el código en texto:
   * la tarifa puede renombrarse o borrarse, y el reporte tiene que seguir
   * diciendo qué se aplicó ese día.
   */
  rateId?: string;
  promoCode?: string;
  promoLabel?: string;
  /** Lo que habría costado sin promoción. Ausente en reservas previas al seguimiento. */
  baseAmount?: number;
  discountAmount?: number;
  /**
   * Precio por noche con el que se tomó bajo tarifa especial. Ausente en las
   * reservas normales. Es fijo: no depende de cuánta gente entre.
   */
  specialRateAmount?: number;
  /**
   * Alquiler del hotel completo: sin habitación asignada, bloquea todo el
   * período. El precio es el monto acordado, no sale de ninguna tarifa.
   */
  isFullHotel?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OtherIncome {
  id: string;
  date: Date;
  description: string;
  method: PaymentMethod;
  amount: number;
  createdBy?: string;
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
  /** Promoción aplicada al cobro. Ver la nota en Booking sobre por qué va el texto además del id. */
  rateId?: string;
  promoCode?: string;
  promoLabel?: string;
  discountAmount?: number;
}

/**
 * El comprobante colgado de un pago: la captura de la transferencia, el PDF del
 * banco, la foto del ticket. El archivo vive en el bucket privado; acá va la
 * ruta y quién lo subió.
 */
export interface PaymentAttachment {
  id: string;
  paymentId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: Date;
}

export type LogbookCategory =
  | 'ROPA_BLANCA' | 'MINIBAR' | 'MANTENIMIENTO' | 'OBJETOS_OLVIDADOS' | 'HUESPED' | 'OTRO';

/**
 * INFO es la anotación que no espera nada de nadie. PENDING deja algo por hacer
 * y RESOLVED es esa misma ya levantada; una INFO nunca llega a RESOLVED.
 */
export type LogbookStatus = 'INFO' | 'PENDING' | 'RESOLVED';

/** Un renglón de la planilla de novedades. */
export interface LogbookEntry {
  id: string;
  /** Cuándo pasó. `createdAt` guarda cuándo se anotó. */
  date: Date;
  category: LogbookCategory;
  note: string;
  roomFromId?: string;
  roomToId?: string;
  status: LogbookStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolvedByName?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt?: Date;
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
  room?: Room;
  roomType?: RoomType;
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
  /** Llegadas de hoy que todavía no hicieron check-in (checkInsToday incluye las ya hechas) */
  pendingCheckInsToday: number;
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
  dailyCashFloat?: number; // "Fijo del día" — cash float kept in the register
  /** Precio por noche de la tarifa especial. 0 = no se ofrece al reservar. */
  specialRateAmount?: number;
  parkingSpots?: number;   // Cocheras del hotel; 0 = sin control de cocheras
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
