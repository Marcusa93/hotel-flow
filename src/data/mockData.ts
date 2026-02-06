import {
  RoomType,
  Room,
  Guest,
  Booking,
  Payment,
  HousekeepingTask,
  Rate,
  NotificationLog,
  RoomStatus,
  BookingStatus,
  PaymentStatus,
  HousekeepingStatus,
} from '@/types/hotel';

// Room Types
export const initialRoomTypes: RoomType[] = [
  { id: 'rt-1', name: 'Estándar', basePrice: 8500, maxGuests: 2, description: 'Habitación cómoda con cama doble' },
  { id: 'rt-2', name: 'Superior', basePrice: 12000, maxGuests: 3, description: 'Habitación amplia con vista al jardín' },
  { id: 'rt-3', name: 'Suite', basePrice: 18500, maxGuests: 4, description: 'Suite con sala de estar separada' },
  { id: 'rt-4', name: 'Suite Ejecutiva', basePrice: 25000, maxGuests: 4, description: 'Suite premium con jacuzzi' },
];

// Rooms (20 habitaciones)
export const initialRooms: Room[] = [
  // Planta Baja
  { id: 'r-101', roomNumber: '101', roomTypeId: 'rt-1', floor: 1, status: 'OCCUPIED' },
  { id: 'r-102', roomNumber: '102', roomTypeId: 'rt-1', floor: 1, status: 'AVAILABLE' },
  { id: 'r-103', roomNumber: '103', roomTypeId: 'rt-2', floor: 1, status: 'DIRTY' },
  { id: 'r-104', roomNumber: '104', roomTypeId: 'rt-2', floor: 1, status: 'OCCUPIED' },
  { id: 'r-105', roomNumber: '105', roomTypeId: 'rt-1', floor: 1, status: 'AVAILABLE' },
  // Primer Piso
  { id: 'r-201', roomNumber: '201', roomTypeId: 'rt-1', floor: 2, status: 'AVAILABLE' },
  { id: 'r-202', roomNumber: '202', roomTypeId: 'rt-2', floor: 2, status: 'OCCUPIED' },
  { id: 'r-203', roomNumber: '203', roomTypeId: 'rt-3', floor: 2, status: 'MAINTENANCE', notes: 'Reparación de aire acondicionado' },
  { id: 'r-204', roomNumber: '204', roomTypeId: 'rt-2', floor: 2, status: 'AVAILABLE' },
  { id: 'r-205', roomNumber: '205', roomTypeId: 'rt-1', floor: 2, status: 'DIRTY' },
  // Segundo Piso
  { id: 'r-301', roomNumber: '301', roomTypeId: 'rt-3', floor: 3, status: 'OCCUPIED' },
  { id: 'r-302', roomNumber: '302', roomTypeId: 'rt-3', floor: 3, status: 'AVAILABLE' },
  { id: 'r-303', roomNumber: '303', roomTypeId: 'rt-4', floor: 3, status: 'OCCUPIED' },
  { id: 'r-304', roomNumber: '304', roomTypeId: 'rt-4', floor: 3, status: 'OUT_OF_ORDER', notes: 'Renovación completa' },
  { id: 'r-305', roomNumber: '305', roomTypeId: 'rt-3', floor: 3, status: 'AVAILABLE' },
  // Tercer Piso
  { id: 'r-401', roomNumber: '401', roomTypeId: 'rt-2', floor: 4, status: 'AVAILABLE' },
  { id: 'r-402', roomNumber: '402', roomTypeId: 'rt-2', floor: 4, status: 'OCCUPIED' },
  { id: 'r-403', roomNumber: '403', roomTypeId: 'rt-1', floor: 4, status: 'AVAILABLE' },
  { id: 'r-404', roomNumber: '404', roomTypeId: 'rt-1', floor: 4, status: 'AVAILABLE' },
  { id: 'r-405', roomNumber: '405', roomTypeId: 'rt-3', floor: 4, status: 'DIRTY' },
];

// Guests
export const initialGuests: Guest[] = [
  { id: 'g-1', fullName: 'María García López', documentId: '12345678A', phone: '+54 11 4567-8901', email: 'maria.garcia@email.com', createdAt: new Date('2024-01-15') },
  { id: 'g-2', fullName: 'Carlos Rodríguez Pérez', documentId: '87654321B', phone: '+54 11 2345-6789', email: 'carlos.rodriguez@email.com', notes: 'Prefiere habitación alta', createdAt: new Date('2024-02-20') },
  { id: 'g-3', fullName: 'Ana Martínez Sánchez', documentId: '11223344C', phone: '+54 11 9876-5432', email: 'ana.martinez@email.com', createdAt: new Date('2024-03-10') },
  { id: 'g-4', fullName: 'Roberto Fernández Ruiz', documentId: '55667788D', phone: '+54 11 3456-7890', email: 'roberto.fernandez@email.com', notes: 'Alérgico a plumas', createdAt: new Date('2024-04-05') },
  { id: 'g-5', fullName: 'Laura González Torres', documentId: '99887766E', phone: '+54 11 6789-0123', email: 'laura.gonzalez@email.com', createdAt: new Date('2024-05-12') },
  { id: 'g-6', fullName: 'Diego Morales Vega', phone: '+54 11 1234-5678', email: 'diego.morales@email.com', createdAt: new Date('2024-06-01') },
  { id: 'g-7', fullName: 'Patricia Núñez Castro', documentId: '33445566F', phone: '+54 11 8901-2345', email: 'patricia.nunez@email.com', notes: 'VIP - Cliente frecuente', createdAt: new Date('2024-06-15') },
  { id: 'g-8', fullName: 'Javier López Mendoza', documentId: '77889900G', phone: '+54 11 4567-8901', email: 'javier.lopez@email.com', createdAt: new Date('2024-07-20') },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const inThreeDays = new Date(today);
inThreeDays.setDate(inThreeDays.getDate() + 3);
const inFiveDays = new Date(today);
inFiveDays.setDate(inFiveDays.getDate() + 5);
const inSevenDays = new Date(today);
inSevenDays.setDate(inSevenDays.getDate() + 7);
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 7);
const twoWeeksAgo = new Date(today);
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

// Bookings
export const initialBookings: Booking[] = [
  // Reservas actuales (checked-in)
  { id: 'b-1', guestId: 'g-1', roomId: 'r-101', checkInDate: yesterday, checkOutDate: inThreeDays, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 25500, createdAt: lastWeek },
  { id: 'b-2', guestId: 'g-2', roomId: 'r-104', checkInDate: twoWeeksAgo, checkOutDate: today, adults: 2, children: 1, status: 'CHECKED_IN', totalAmount: 168000, createdAt: twoWeeksAgo },
  { id: 'b-3', guestId: 'g-3', roomId: 'r-202', checkInDate: lastWeek, checkOutDate: tomorrow, adults: 1, children: 0, status: 'CHECKED_IN', totalAmount: 96000, createdAt: lastWeek },
  { id: 'b-4', guestId: 'g-4', roomId: 'r-301', checkInDate: yesterday, checkOutDate: inFiveDays, adults: 2, children: 2, status: 'CHECKED_IN', totalAmount: 111000, createdAt: lastWeek },
  { id: 'b-5', guestId: 'g-5', roomId: 'r-303', checkInDate: lastWeek, checkOutDate: inThreeDays, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 250000, createdAt: twoWeeksAgo },
  { id: 'b-6', guestId: 'g-7', roomId: 'r-402', checkInDate: yesterday, checkOutDate: inSevenDays, adults: 2, children: 1, status: 'CHECKED_IN', totalAmount: 96000, createdAt: lastWeek },
  
  // Reservas confirmadas (futuras)
  { id: 'b-7', guestId: 'g-6', roomId: 'r-102', checkInDate: tomorrow, checkOutDate: inFiveDays, adults: 2, children: 0, status: 'CONFIRMED', totalAmount: 34000, createdAt: yesterday },
  { id: 'b-8', guestId: 'g-8', roomId: 'r-201', checkInDate: inThreeDays, checkOutDate: inSevenDays, adults: 1, children: 0, status: 'CONFIRMED', totalAmount: 34000, createdAt: today },
  
  // Check-in hoy
  { id: 'b-9', guestId: 'g-1', roomId: 'r-305', checkInDate: today, checkOutDate: inFiveDays, adults: 2, children: 1, status: 'CONFIRMED', totalAmount: 92500, createdAt: lastWeek },
  
  // Check-out hoy
  { id: 'b-10', guestId: 'g-3', roomId: 'r-103', checkInDate: lastWeek, checkOutDate: today, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 84000, createdAt: twoWeeksAgo },
  
  // Reserva pendiente
  { id: 'b-11', guestId: 'g-6', roomId: 'r-401', checkInDate: inFiveDays, checkOutDate: inSevenDays, adults: 2, children: 0, status: 'PENDING', totalAmount: 24000, createdAt: today },
  
  // Reservas pasadas
  { id: 'b-12', guestId: 'g-7', roomId: 'r-205', checkInDate: new Date(today.getFullYear(), today.getMonth(), 1), checkOutDate: new Date(today.getFullYear(), today.getMonth(), 5), adults: 2, children: 0, status: 'CHECKED_OUT', totalAmount: 34000, createdAt: new Date(today.getFullYear(), today.getMonth() - 1, 25) },
  { id: 'b-13', guestId: 'g-8', roomId: 'r-302', checkInDate: new Date(today.getFullYear(), today.getMonth(), 8), checkOutDate: new Date(today.getFullYear(), today.getMonth(), 12), adults: 2, children: 2, status: 'CHECKED_OUT', totalAmount: 74000, createdAt: new Date(today.getFullYear(), today.getMonth(), 1) },
];

// Payments
export const initialPayments: Payment[] = [
  { id: 'p-1', bookingId: 'b-1', date: lastWeek, method: 'CARD', reference: 'TXN-001234', status: 'PAID', amount: 25500 },
  { id: 'p-2', bookingId: 'b-2', date: twoWeeksAgo, method: 'TRANSFER', reference: 'TRF-005678', status: 'PAID', amount: 100000 },
  { id: 'p-3', bookingId: 'b-2', date: lastWeek, method: 'CASH', status: 'PAID', amount: 68000, comment: 'Pago restante' },
  { id: 'p-4', bookingId: 'b-3', date: lastWeek, method: 'CARD', reference: 'TXN-002345', status: 'PAID', amount: 96000 },
  { id: 'p-5', bookingId: 'b-4', date: yesterday, method: 'TRANSFER', reference: 'TRF-006789', status: 'PAID', amount: 55500 },
  { id: 'p-6', bookingId: 'b-4', date: today, method: 'OTHER', status: 'PENDING', amount: 55500, comment: 'Pendiente al checkout' },
  { id: 'p-7', bookingId: 'b-5', date: twoWeeksAgo, method: 'CARD', reference: 'TXN-003456', status: 'PAID', amount: 250000 },
  { id: 'p-8', bookingId: 'b-6', date: yesterday, method: 'CASH', status: 'PAID', amount: 50000 },
  { id: 'p-9', bookingId: 'b-7', date: yesterday, method: 'TRANSFER', reference: 'TRF-007890', status: 'PAID', amount: 17000, comment: 'Seña 50%' },
  { id: 'p-10', bookingId: 'b-9', date: lastWeek, method: 'CARD', reference: 'TXN-004567', status: 'PAID', amount: 92500 },
  { id: 'p-11', bookingId: 'b-10', date: twoWeeksAgo, method: 'CASH', status: 'PAID', amount: 42000 },
  { id: 'p-12', bookingId: 'b-10', date: today, method: 'OTHER', status: 'PENDING', amount: 42000 },
  { id: 'p-13', bookingId: 'b-12', date: new Date(today.getFullYear(), today.getMonth(), 1), method: 'CARD', reference: 'TXN-000111', status: 'PAID', amount: 34000 },
  { id: 'p-14', bookingId: 'b-13', date: new Date(today.getFullYear(), today.getMonth(), 8), method: 'TRANSFER', reference: 'TRF-000222', status: 'PAID', amount: 74000 },
];

// Housekeeping Tasks
export const initialHousekeepingTasks: HousekeepingTask[] = [
  { id: 'ht-1', roomId: 'r-103', date: today, assignedTo: 'María López', status: 'TODO', notes: 'Check-out hoy - limpieza profunda' },
  { id: 'ht-2', roomId: 'r-205', date: today, assignedTo: 'María López', status: 'IN_PROGRESS' },
  { id: 'ht-3', roomId: 'r-405', date: today, assignedTo: 'Juan Pérez', status: 'TODO' },
  { id: 'ht-4', roomId: 'r-101', date: today, assignedTo: 'María López', status: 'DONE', notes: 'Servicio de habitación' },
  { id: 'ht-5', roomId: 'r-301', date: today, assignedTo: 'Juan Pérez', status: 'DONE' },
  { id: 'ht-6', roomId: 'r-102', date: tomorrow, status: 'TODO', notes: 'Preparar para check-in' },
];

// Rates/Promotions
export const initialRates: Rate[] = [
  { id: 'rate-1', roomTypeId: 'rt-1', startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0), price: 8500, label: 'Tarifa Base', isActive: true },
  { id: 'rate-2', roomTypeId: 'rt-2', startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0), price: 12000, label: 'Tarifa Base', isActive: true },
  { id: 'rate-3', roomTypeId: 'rt-3', startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0), price: 18500, label: 'Tarifa Base', isActive: true },
  { id: 'rate-4', roomTypeId: 'rt-4', startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0), price: 25000, label: 'Tarifa Base', isActive: true },
  { id: 'rate-5', roomTypeId: 'rt-1', startDate: new Date(today.getFullYear(), 11, 20), endDate: new Date(today.getFullYear() + 1, 0, 5), price: 12000, label: 'Temporada Alta - Fiestas', isActive: true },
  { id: 'rate-6', roomTypeId: 'rt-2', startDate: new Date(today.getFullYear(), 11, 20), endDate: new Date(today.getFullYear() + 1, 0, 5), price: 18000, label: 'Temporada Alta - Fiestas', isActive: true },
  { id: 'rate-7', roomTypeId: 'rt-3', startDate: new Date(today.getFullYear(), 11, 20), endDate: new Date(today.getFullYear() + 1, 0, 5), price: 28000, label: 'Temporada Alta - Fiestas', isActive: true },
  { id: 'rate-8', roomTypeId: 'rt-1', startDate: inThreeDays, endDate: inSevenDays, price: 6800, label: 'Promo Midweek -20%', isActive: true },
];

// Notification Logs
export const initialNotificationLogs: NotificationLog[] = [
  { id: 'nl-1', type: 'email', recipient: 'maria.garcia@email.com', subject: 'Confirmación de reserva #b-1', status: 'sent', createdAt: lastWeek, bookingId: 'b-1' },
  { id: 'nl-2', type: 'whatsapp', recipient: '+54 11 4567-8901', subject: 'Recordatorio check-in mañana', status: 'sent', createdAt: new Date(yesterday.getTime() - 86400000), bookingId: 'b-1' },
  { id: 'nl-3', type: 'email', recipient: 'carlos.rodriguez@email.com', subject: 'Confirmación de reserva #b-2', status: 'sent', createdAt: twoWeeksAgo, bookingId: 'b-2' },
  { id: 'nl-4', type: 'email', recipient: 'diego.morales@email.com', subject: 'Confirmación de reserva #b-7', status: 'sent', createdAt: yesterday, bookingId: 'b-7' },
  { id: 'nl-5', type: 'email', recipient: 'test@failed.com', subject: 'Test fallido', status: 'failed', createdAt: today },
];
