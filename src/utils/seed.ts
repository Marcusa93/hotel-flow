
import { supabase } from '@/lib/supabase';
import { initialRoomTypes, initialRooms, initialGuests, initialBookings, initialPayments, initialHousekeepingTasks } from '@/data/mockData';

export async function seedDatabase() {
    console.log('Starting seed...');
    const idMap = {
        roomTypes: {} as Record<string, string>,
        rooms: {} as Record<string, string>,
        guests: {} as Record<string, string>,
    };

    try {
        // 1. Room Types
        console.log('Seeding Room Types...');
        for (const rt of initialRoomTypes) {
            const { data, error } = await supabase
                .from('room_types')
                .insert({
                    name: rt.name,
                    base_price: rt.basePrice,
                    max_guests: rt.maxGuests,
                    description: rt.description,
                })
                .select()
                .single();

            if (error) throw error;
            idMap.roomTypes[rt.id] = data.id;
        }

        // 2. Rooms
        console.log('Seeding Rooms...');
        for (const r of initialRooms) {
            const rtId = idMap.roomTypes[r.roomTypeId];
            if (!rtId) {
                console.warn(`Skipping room ${r.roomNumber}, room type not found`);
                continue;
            }

            const { data, error } = await supabase
                .from('rooms')
                .insert({
                    room_number: r.roomNumber,
                    room_type_id: rtId,
                    floor: r.floor,
                    status: r.status,
                    notes: r.notes,
                })
                .select()
                .single();

            if (error) throw error;
            idMap.rooms[r.id] = data.id;
        }

        // 3. Guests
        console.log('Seeding Guests...');
        for (const g of initialGuests) {
            const { data, error } = await supabase
                .from('guests')
                .insert({
                    full_name: g.fullName,
                    document_id: g.documentId,
                    phone: g.phone,
                    email: g.email,
                    notes: g.notes,
                })
                .select()
                .single();

            if (error) throw error;
            idMap.guests[g.id] = data.id;
        }

        // 4. Bookings
        console.log('Seeding Bookings...');
        for (const b of initialBookings) {
            const guestId = idMap.guests[b.guestId];
            const roomId = idMap.rooms[b.roomId];

            if (!guestId || !roomId) {
                console.warn(`Skipping booking ${b.id}, guest or room not found`);
                continue;
            }

            const { error } = await supabase
                .from('bookings')
                .insert({
                    guest_id: guestId,
                    room_id: roomId,
                    check_in_date: b.checkInDate.toISOString(),
                    check_out_date: b.checkOutDate.toISOString(),
                    adults: b.adults,
                    children: b.children,
                    status: b.status,
                    total_amount: b.totalAmount,
                });

            if (error) throw error;
        }

        console.log('Seeding complete!');
        return { success: true };

    } catch (error) {
        console.error('Seeding failed:', error);
        return { success: false, error };
    }
}
