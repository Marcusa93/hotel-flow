
// --- Data (Copied/Adapted from mockData.ts to avoid alias issues) ---

const roomTypes = [
    { id: 'rt-1', name: 'Estándar', basePrice: 8500, maxGuests: 2, description: 'Habitación cómoda con cama doble' },
    { id: 'rt-2', name: 'Superior', basePrice: 12000, maxGuests: 3, description: 'Habitación amplia con vista al jardín' },
    { id: 'rt-3', name: 'Suite', basePrice: 18500, maxGuests: 4, description: 'Suite con sala de estar separada' },
    { id: 'rt-4', name: 'Suite Ejecutiva', basePrice: 25000, maxGuests: 4, description: 'Suite premium con jacuzzi' },
];

const rooms = [
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

const guests = [
    { id: 'g-1', fullName: 'María García López', documentId: '12345678A', phone: '+54 11 4567-8901', email: 'maria.garcia@email.com' },
    { id: 'g-2', fullName: 'Carlos Rodríguez Pérez', documentId: '87654321B', phone: '+54 11 2345-6789', email: 'carlos.rodriguez@email.com', notes: 'Prefiere habitación alta' },
    { id: 'g-3', fullName: 'Ana Martínez Sánchez', documentId: '11223344C', phone: '+54 11 9876-5432', email: 'ana.martinez@email.com' },
    { id: 'g-4', fullName: 'Roberto Fernández Ruiz', documentId: '55667788D', phone: '+54 11 3456-7890', email: 'roberto.fernandez@email.com', notes: 'Alérgico a plumas' },
    { id: 'g-5', fullName: 'Laura González Torres', documentId: '99887766E', phone: '+54 11 6789-0123', email: 'laura.gonzalez@email.com' },
    { id: 'g-6', fullName: 'Diego Morales Vega', phone: '+54 11 1234-5678', email: 'diego.morales@email.com' },
    { id: 'g-7', fullName: 'Patricia Núñez Castro', documentId: '33445566F', phone: '+54 11 8901-2345', email: 'patricia.nunez@email.com', notes: 'VIP - Cliente frecuente' },
    { id: 'g-8', fullName: 'Javier López Mendoza', documentId: '77889900G', phone: '+54 11 4567-8901', email: 'javier.lopez@email.com' },
];

// Helper to calc dates (reproduced from mockData)
const today = new Date();
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
const inThreeDays = new Date(today); inThreeDays.setDate(inThreeDays.getDate() + 3);
const inFiveDays = new Date(today); inFiveDays.setDate(inFiveDays.getDate() + 5);
const inSevenDays = new Date(today); inSevenDays.setDate(inSevenDays.getDate() + 7);
const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);
const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

const bookings = [
    { id: 'b-1', guestId: 'g-1', roomId: 'r-101', checkInDate: yesterday, checkOutDate: inThreeDays, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 25500 },
    { id: 'b-2', guestId: 'g-2', roomId: 'r-104', checkInDate: twoWeeksAgo, checkOutDate: today, adults: 2, children: 1, status: 'CHECKED_IN', totalAmount: 168000 },
    { id: 'b-3', guestId: 'g-3', roomId: 'r-202', checkInDate: lastWeek, checkOutDate: tomorrow, adults: 1, children: 0, status: 'CHECKED_IN', totalAmount: 96000 },
    { id: 'b-4', guestId: 'g-4', roomId: 'r-301', checkInDate: yesterday, checkOutDate: inFiveDays, adults: 2, children: 2, status: 'CHECKED_IN', totalAmount: 111000 },
    { id: 'b-5', guestId: 'g-5', roomId: 'r-303', checkInDate: lastWeek, checkOutDate: inThreeDays, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 250000 },
    { id: 'b-6', guestId: 'g-7', roomId: 'r-402', checkInDate: yesterday, checkOutDate: inSevenDays, adults: 2, children: 1, status: 'CHECKED_IN', totalAmount: 96000 },
    { id: 'b-7', guestId: 'g-6', roomId: 'r-102', checkInDate: tomorrow, checkOutDate: inFiveDays, adults: 2, children: 0, status: 'CONFIRMED', totalAmount: 34000 },
    { id: 'b-8', guestId: 'g-8', roomId: 'r-201', checkInDate: inThreeDays, checkOutDate: inSevenDays, adults: 1, children: 0, status: 'CONFIRMED', totalAmount: 34000 },
    { id: 'b-9', guestId: 'g-1', roomId: 'r-305', checkInDate: today, checkOutDate: inFiveDays, adults: 2, children: 1, status: 'CONFIRMED', totalAmount: 92500 },
    { id: 'b-10', guestId: 'g-3', roomId: 'r-103', checkInDate: lastWeek, checkOutDate: today, adults: 2, children: 0, status: 'CHECKED_IN', totalAmount: 84000 },
    { id: 'b-11', guestId: 'g-6', roomId: 'r-401', checkInDate: inFiveDays, checkOutDate: inSevenDays, adults: 2, children: 0, status: 'PENDING', totalAmount: 24000 },
    { id: 'b-12', guestId: 'g-7', roomId: 'r-205', checkInDate: new Date(today.getFullYear(), today.getMonth(), 1), checkOutDate: new Date(today.getFullYear(), today.getMonth(), 5), adults: 2, children: 0, status: 'CHECKED_OUT', totalAmount: 34000 },
    { id: 'b-13', guestId: 'g-8', roomId: 'r-302', checkInDate: new Date(today.getFullYear(), today.getMonth(), 8), checkOutDate: new Date(today.getFullYear(), today.getMonth(), 12), adults: 2, children: 2, status: 'CHECKED_OUT', totalAmount: 74000 },
];

function escapeSql(str: string | undefined): string {
    if (str === undefined || str === null) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
}

function formatDate(d: Date): string {
    return `'${d.toISOString()}'`;
}

const idMap = {
    roomTypes: {} as Record<string, string>,
    rooms: {} as Record<string, string>,
    guests: {} as Record<string, string>,
    bookings: {} as Record<string, string>,
};

function generateSql() {
    const sqlLines: string[] = [];

    // 1. Room Types
    sqlLines.push('-- Room Types');
    for (const rt of roomTypes) {
        const newId = crypto.randomUUID();
        idMap.roomTypes[rt.id] = newId;
        sqlLines.push(`INSERT INTO public.room_types (id, name, base_price, max_guests, description) VALUES ('${newId}', ${escapeSql(rt.name)}, ${rt.basePrice}, ${rt.maxGuests}, ${escapeSql(rt.description)});`);
    }

    // 2. Rooms
    sqlLines.push('\\n-- Rooms');
    for (const r of rooms) {
        const newId = crypto.randomUUID();
        idMap.rooms[r.id] = newId;
        const rtId = idMap.roomTypes[r.roomTypeId];
        sqlLines.push(`INSERT INTO public.rooms (id, room_number, room_type_id, floor, status, notes) VALUES ('${newId}', ${escapeSql(r.roomNumber)}, '${rtId}', ${r.floor}, ${escapeSql(r.status)}, ${escapeSql(r.notes)});`);
    }

    // 3. Guests
    sqlLines.push('\\n-- Guests');
    for (const g of guests) {
        const newId = crypto.randomUUID();
        idMap.guests[g.id] = newId;
        sqlLines.push(`INSERT INTO public.guests (id, full_name, document_id, phone, email, notes) VALUES ('${newId}', ${escapeSql(g.fullName)}, ${escapeSql(g.documentId)}, ${escapeSql(g.phone)}, ${escapeSql(g.email)}, ${escapeSql(g.notes)});`);
    }

    // 4. Bookings
    sqlLines.push('\\n-- Bookings');
    for (const b of bookings) {
        const newId = crypto.randomUUID();
        idMap.bookings[b.id] = newId;
        const guestId = idMap.guests[b.guestId];
        const roomId = idMap.rooms[b.roomId];
        if (guestId && roomId) {
            sqlLines.push(`INSERT INTO public.bookings (id, guest_id, room_id, check_in_date, check_out_date, adults, children, status, total_amount) VALUES ('${newId}', '${guestId}', '${roomId}', ${formatDate(b.checkInDate)}, ${formatDate(b.checkOutDate)}, ${b.adults}, ${b.children}, ${escapeSql(b.status)}, ${b.totalAmount});`);
        }
    }

    console.log(sqlLines.join('\\n'));
}

generateSql();
