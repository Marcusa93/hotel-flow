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
export type AuditEntityType = 'booking' | 'guest' | 'room' | 'payment' | 'invoice' | 'housekeeping_task' | 'rate' | 'expense' | 'hotel_settings' | 'booking_charge' | 'logbook_entry' | 'cash_closing';

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
  /**
   * Limpieza no la habilitó: está limpia pero no en condiciones de recibir a
   * alguien. Separado del status porque MAINTENANCE y OUT_OF_ORDER los pone
   * recepción por sus propios motivos.
   */
  housekeepingHold?: boolean;
  /** Qué le pasa, según limpieza. Vale sin el bloqueo: una advertencia sola también sirve. */
  housekeepingNote?: string;
  housekeepingNoteBy?: string;
  housekeepingNoteAt?: Date;
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

/**
 * Una reserva masiva: un contingente que toma varias habitaciones.
 *
 * No es una reserva: es lo que une a varias. Cada habitación conserva su reserva
 * normal —con su check-in, su limpieza y su lugar en el tablero— y el grupo
 * agrega lo único que no existía, que es un precio para el conjunto.
 */
export interface BookingGroup {
  id: string;
  /** A nombre de quién: la empresa, el equipo, quien contrata. */
  guestId?: string;
  notes?: string;
  /**
   * Lo acordado por todo el paquete. `null` es "a tarifar", y es un estado real:
   * la reserva nace así porque el precio de un grupo lo cierra administración.
   * Null y no cero — en cero el grupo figuraría sin deuda.
   */
  totalAmount?: number | null;
  pricedAt?: Date;
  pricedBy?: string;
  pricedByName?: string;
  createdAt: Date;
  createdBy?: string;
  createdByName?: string;
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
   * Por qué se le hizo ese precio: "dueño", "cortesía", "amigo de X".
   *
   * Una reserva en cero no genera deuda ni alerta, así que sin esto queda una
   * habitación ocupada que no generó un peso y nada que explique por qué.
   */
  specialRateReason?: string;
  /**
   * Tramo de tarifa elegido a mano en el mostrador. Ausente —la enorme
   * mayoría— significa el que corresponde por la gente que entra. Cuando está,
   * manda: ni la edición ni el check-in lo recalculan.
   */
  pricingRoomTypeId?: string;
  /**
   * Alquiler del hotel completo: sin habitación asignada, bloquea todo el
   * período. El precio es el monto acordado, no sale de ninguna tarifa.
   */
  isFullHotel?: boolean;
  /**
   * Media estadía: entra y sale el mismo día, de 10:00 a 18:00. `checkOutDate`
   * es igual a `checkInDate`, así que no tiene noches, y el precio es el 50% del
   * tramo. No admite promoción ni tarifa especial.
   */
  isHalfDay?: boolean;
  /**
   * La reserva masiva a la que pertenece, si es de un contingente.
   *
   * La reserva sigue siendo de UNA habitación: el grupo solo la une con las
   * demás para ponerles un precio en común. Ver bookingGroup.ts.
   */
  groupId?: string;
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
  /**
   * De dónde salió la plata. Ausente en los gastos anteriores a la columna: no
   * se sabe si salieron de la caja, así que no descuentan del efectivo a rendir.
   */
  method?: SettlementMethod;
  /**
   * De qué caja salió, cuando se pagó en efectivo. Ausente en los que no son
   * efectivo y en los cargados antes de la columna, que se leen como
   * RECAUDACION porque así se venían contando.
   */
  cashSource?: CashSource;
  createdAt: Date;
}

/**
 * Los dos pozos de efectivo del hotel.
 *
 * RECAUDACION es lo cobrado a huéspedes: es lo que se rinde. EMPRESA es la plata
 * que pone el hotel para las compras del día, y gastarla no toca lo que hay que
 * rendir.
 */
export type CashSource = 'RECAUDACION' | 'EMPRESA';

/** Efectivo que la empresa pone en la caja para gastos. No es un ingreso. */
export interface CashContribution {
  id: string;
  date: Date;
  amount: number;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
}

/**
 * Un día de caja ya cerrado, con los números tal como estaban al cerrarlo.
 *
 * Se guarda el corte y no solo la fecha: si después alguien corrige un gasto
 * viejo, el cierre firmado tiene que seguir diciendo lo mismo, y la pantalla
 * poder avisar que lo de hoy ya no coincide.
 */
export interface CashClosing {
  id: string;
  closingDate: Date;
  cashIncome: number;
  cashFloat: number;
  cashExpenses: number;
  cashToDeposit: number;
  totalIncome: number;
  totalExpenses: number;
  notes?: string;
  closedAt: Date;
  closedBy?: string;
  closedByName?: string;
  /** Con valor, el día volvió a estar pendiente. Solo administración reabre. */
  reopenedAt?: Date;
  reopenedBy?: string;
  reopenedByName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** Un turno de caja: desde que se abre hasta que se cierra. */
export interface CashSession {
  id: string;
  openedAt: Date;
  openedBy?: string;
  openedByName?: string;
  /** Efectivo en cajón al abrir el turno. Actúa como fondo inicial. */
  openingAmount: number;
  closedAt?: Date;
  closedBy?: string;
  closedByName?: string;
  notes?: string;
  /** Snapshot guardado al cerrar (para detectar si algo cambió después). */
  snapCashIncome?: number;
  snapCashExpenses?: number;
  snapCashToDeposit?: number;
  snapTotalIncome?: number;
  snapTotalExpenses?: number;
  createdAt: Date;
}

/** El fondo fijo que queda en la caja un día puntual. */
export interface CashFloat {
  date: Date;
  amount: number;
  setBy?: string;
  setByName?: string;
  updatedAt: Date;
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
  /** Horarios de la media estadía. Aparte de los de arriba: es otra política. */
  halfDayCheckInTime?: string;   // e.g. "10:00"
  halfDayCheckOutTime?: string;  // e.g. "18:00"
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
