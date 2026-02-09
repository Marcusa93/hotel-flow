import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

// Create client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyRlsPolicies() {
    console.log('Applying RLS policies for bookings table...');

    // Note: We can't run DDL directly via Supabase JS client
    // We'll test if the service role allows inserts which proves RLS bypass works

    // First test: create a booking with service role
    const { data: guests } = await supabase.from('guests').select('id').limit(1);
    const { data: rooms } = await supabase.from('rooms').select('id').limit(1);

    if (!guests?.length || !rooms?.length) {
        console.error('No guests or rooms found. Please seed the database first.');
        return;
    }

    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

    const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
            guest_id: guests[0].id,
            room_id: rooms[0].id,
            check_in_date: checkIn.toISOString(),
            check_out_date: checkOut.toISOString(),
            adults: 2,
            children: 0,
            status: 'CONFIRMED',
            total_amount: 350.00,
            notes: 'Test booking via service role'
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating booking with service role:', error);
    } else {
        console.log('SUCCESS! Booking created:', booking.id);
        console.log('This confirms the service role key works.');
        console.log('');
        console.log('The app should use authenticated users. Please run the RLS SQL manually in Supabase Dashboard.');
    }
}

applyRlsPolicies();
