import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateBooking() {
    console.log('Testing Booking Creation...');

    // 1. Get a random guest
    const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('id')
        .limit(1);

    if (guestError || !guests || guests.length === 0) {
        console.error('Error fetching guest:', guestError);
        return;
    }
    const guestId = guests[0].id;
    console.log(`Using Guest ID: ${guestId}`);

    // 2. Get a random room
    const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .limit(1);

    if (roomError || !rooms || rooms.length === 0) {
        console.error('Error fetching room:', roomError);
        return;
    }
    const roomId = rooms[0].id;
    console.log(`Using Room ID: ${roomId}`);

    // 3. Create Booking
    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    const bookingData = {
        guest_id: guestId,
        room_id: roomId,
        check_in_date: checkIn.toISOString(),
        check_out_date: checkOut.toISOString(),
        adults: 2,
        children: 0,
        status: 'CONFIRMED',
        total_amount: 500.00,
        notes: 'Test booking via script'
    };

    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

    if (bookingError) {
        console.error('Error creating booking:', bookingError);
    } else {
        console.log('Booking successfully created:', booking);
        // Cleanup? Maybe keep it to verify in UI
    }
}

testCreateBooking();
