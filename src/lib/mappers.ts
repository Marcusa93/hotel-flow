import type {
  RoomType,
  Room,
  Guest,
  Booking,
  Payment,
  HousekeepingTask,
  Rate,
  Expense,
  Invoice,
  InvoiceItem,
  HotelSettings,
  AuditLog,
  BookingCharge,
} from '@/types/hotel';

// --- Row to Model mappers (snake_case DB → camelCase frontend) ---

/** Raw database row from Supabase (untyped — replace with generated types when available) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

export const mapRoomType = (row: DbRow): RoomType => ({
  id: row.id,
  name: row.name,
  basePrice: row.base_price,
  maxGuests: row.max_guests,
  description: row.description,
});

export const mapRoom = (row: DbRow): Room => ({
  id: row.id,
  roomNumber: row.room_number,
  roomTypeId: row.room_type_id,
  floor: row.floor,
  status: row.status,
  notes: row.notes,
});

export const mapGuest = (row: DbRow): Guest => ({
  id: row.id,
  fullName: row.full_name,
  documentType: row.document_type,
  documentId: row.document_id,
  phone: row.phone,
  email: row.email,
  notes: row.notes,
  country: row.country,
  hasVehicle: row.has_vehicle ?? false,
  vehicleDescription: row.vehicle_description,
  licensePlate: row.license_plate,
  createdAt: new Date(row.created_at || new Date()),
});

export const mapBooking = (row: DbRow): Booking => ({
  id: row.id,
  guestId: row.guest_id,
  roomId: row.room_id,
  checkInDate: new Date(row.check_in_date),
  checkOutDate: new Date(row.check_out_date),
  adults: row.adults,
  children: row.children,
  status: row.status,
  totalAmount: row.total_amount,
  notes: row.notes,
  needsReview: row.needs_review,
  hasVehicle: row.has_vehicle ?? false,
  vehicleDescription: row.vehicle_description,
  licensePlate: row.license_plate,
  createdAt: new Date(row.created_at || new Date()),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
});

export const mapPayment = (row: DbRow): Payment => ({
  id: row.id,
  bookingId: row.booking_id,
  amount: Number(row.amount),
  method: row.method,
  status: row.status,
  date: new Date(row.date),
  reference: row.reference,
  comment: row.comment,
});

/** Parse a date-only string (YYYY-MM-DD) as local midnight instead of UTC */
function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // DATE columns come as "YYYY-MM-DD" — append T00:00:00 so JS treats it as local
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T00:00:00');
  }
  return new Date(value);
}

export const mapHousekeepingTask = (row: DbRow): HousekeepingTask => ({
  id: row.id,
  roomId: row.room_id,
  date: parseLocalDate(row.date),
  assignedTo: row.assigned_to,
  status: row.status,
  notes: row.notes,
  priority: row.priority || 'NORMAL',
  startedAt: row.started_at ? new Date(row.started_at) : undefined,
  completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  durationMinutes: row.duration_minutes,
  checkoutTriggered: row.checkout_triggered,
});

export const mapRate = (row: DbRow): Rate => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  startDate: parseLocalDate(row.start_date),
  endDate: parseLocalDate(row.end_date),
  price: row.price,
  label: row.label,
  isActive: row.is_active,
  discountType: row.discount_type,
  discountPercent: row.discount_percent,
  discountAmount: row.discount_amount,
  minNights: row.min_nights,
  promoCode: row.promo_code,
});

export const mapExpense = (row: DbRow): Expense => ({
  id: row.id,
  date: new Date(row.date),
  expenseType: row.expense_type,
  amount: Number(row.amount),
  description: row.description,
  createdAt: new Date(row.created_at || new Date()),
});

export const mapInvoiceItem = (row: DbRow): InvoiceItem => ({
  id: row.id,
  invoiceId: row.invoice_id,
  description: row.description,
  quantity: row.quantity,
  unitPrice: row.unit_price,
  total: row.total,
  itemType: row.item_type,
});

export const mapInvoice = (row: DbRow): Invoice => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  bookingId: row.booking_id,
  guestId: row.guest_id,
  issueDate: new Date(row.issue_date),
  dueDate: row.due_date ? new Date(row.due_date) : undefined,
  status: row.status,
  subtotal: Number(row.subtotal),
  taxRate: Number(row.tax_rate),
  taxAmount: Number(row.tax_amount),
  total: Number(row.total),
  notes: row.notes,
  signatureData: row.signature_data,
  items: row.invoice_items?.map(mapInvoiceItem),
});

// --- Model to Row mappers (camelCase frontend → snake_case DB) ---

export const guestToRow = (guest: Partial<Guest>): DbRow => {
  const row: DbRow = {};
  if (guest.fullName !== undefined) row.full_name = guest.fullName;
  if (guest.documentType !== undefined) row.document_type = guest.documentType;
  if (guest.documentId !== undefined) row.document_id = guest.documentId;
  if (guest.email !== undefined) row.email = guest.email;
  if (guest.phone !== undefined) row.phone = guest.phone;
  if (guest.notes !== undefined) row.notes = guest.notes;
  if (guest.country !== undefined) row.country = guest.country;
  if (guest.hasVehicle !== undefined) row.has_vehicle = guest.hasVehicle;
  if (guest.vehicleDescription !== undefined) row.vehicle_description = guest.vehicleDescription;
  if (guest.licensePlate !== undefined) row.license_plate = guest.licensePlate;
  return row;
};

export const bookingToRow = (booking: Partial<Booking>): DbRow => {
  const row: DbRow = {};
  if (booking.guestId !== undefined) row.guest_id = booking.guestId;
  if (booking.roomId !== undefined) row.room_id = booking.roomId;
  if (booking.checkInDate !== undefined) row.check_in_date = booking.checkInDate instanceof Date ? booking.checkInDate.toISOString() : booking.checkInDate;
  if (booking.checkOutDate !== undefined) row.check_out_date = booking.checkOutDate instanceof Date ? booking.checkOutDate.toISOString() : booking.checkOutDate;
  if (booking.adults !== undefined) row.adults = booking.adults;
  if (booking.children !== undefined) row.children = booking.children;
  if (booking.status !== undefined) row.status = booking.status;
  if (booking.totalAmount !== undefined) row.total_amount = booking.totalAmount;
  if (booking.notes !== undefined) row.notes = booking.notes;
  if (booking.hasVehicle !== undefined) row.has_vehicle = booking.hasVehicle;
  if (booking.vehicleDescription !== undefined) row.vehicle_description = booking.vehicleDescription;
  if (booking.licensePlate !== undefined) row.license_plate = booking.licensePlate;
  return row;
};

export const mapHotelSettings = (row: DbRow): HotelSettings => ({
  id: row.id,
  hotelName: row.hotel_name,
  address: row.address || '',
  phone: row.phone || '',
  email: row.email || '',
  logoUrl: row.logo_url || '',
  currency: row.currency,
  timezone: row.timezone,
  notificationEmailEnabled: row.notification_email_enabled,
  notificationWhatsappEnabled: row.notification_whatsapp_enabled,
  notificationSendOnBooking: row.notification_send_on_booking,
  notificationSendOnPayment: row.notification_send_on_payment,
  notificationSendOnCheckIn: row.notification_send_on_check_in,
  notificationSendOnCheckOut: row.notification_send_on_check_out,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export const hotelSettingsToRow = (settings: Partial<HotelSettings>): DbRow => {
  const row: DbRow = {};
  if (settings.hotelName !== undefined) row.hotel_name = settings.hotelName;
  if (settings.address !== undefined) row.address = settings.address;
  if (settings.phone !== undefined) row.phone = settings.phone;
  if (settings.email !== undefined) row.email = settings.email;
  if (settings.logoUrl !== undefined) row.logo_url = settings.logoUrl;
  if (settings.currency !== undefined) row.currency = settings.currency;
  if (settings.timezone !== undefined) row.timezone = settings.timezone;
  if (settings.notificationEmailEnabled !== undefined) row.notification_email_enabled = settings.notificationEmailEnabled;
  if (settings.notificationWhatsappEnabled !== undefined) row.notification_whatsapp_enabled = settings.notificationWhatsappEnabled;
  if (settings.notificationSendOnBooking !== undefined) row.notification_send_on_booking = settings.notificationSendOnBooking;
  if (settings.notificationSendOnPayment !== undefined) row.notification_send_on_payment = settings.notificationSendOnPayment;
  if (settings.notificationSendOnCheckIn !== undefined) row.notification_send_on_check_in = settings.notificationSendOnCheckIn;
  if (settings.notificationSendOnCheckOut !== undefined) row.notification_send_on_check_out = settings.notificationSendOnCheckOut;
  row.updated_at = new Date().toISOString();
  return row;
};

export const mapAuditLog = (row: DbRow): AuditLog => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  userId: row.user_id,
  userEmail: row.user_email,
  userRole: row.user_role,
  description: row.description,
  oldValues: row.old_values || {},
  newValues: row.new_values || {},
  metadata: row.metadata || {},
  createdAt: new Date(row.created_at),
  ipAddress: row.ip_address,
});

export const paymentToRow = (payment: Partial<Payment>): DbRow => {
  const row: DbRow = {};
  if (payment.bookingId !== undefined) row.booking_id = payment.bookingId;
  if (payment.amount !== undefined) row.amount = payment.amount;
  if (payment.method !== undefined) row.method = payment.method;
  if (payment.status !== undefined) row.status = payment.status;
  if (payment.date !== undefined) row.date = payment.date instanceof Date ? payment.date.toISOString() : payment.date;
  if (payment.reference !== undefined) row.reference = payment.reference;
  if (payment.comment !== undefined) row.comment = payment.comment;
  return row;
};

export const mapBookingCharge = (row: DbRow): BookingCharge => ({
  id: row.id,
  bookingId: row.booking_id,
  category: row.category,
  description: row.description,
  amount: Number(row.amount),
  quantity: row.quantity,
  createdAt: new Date(row.created_at || new Date()),
  createdBy: row.created_by,
});
