
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Room } from '@/types/hotel';

export const useRooms = () => {
    return useQuery({
        queryKey: ['rooms'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rooms')
                .select(`
                    *,
                    room_types (
                        name,
                        base_price,
                        max_guests
                    )
                `)
                .order('room_number', { ascending: true }); // Ensure consistent order

            if (error) {
                console.error('Error fetching rooms:', error);
                throw error;
            }

            // Map database columns to existing frontend type if needed
            // The table structure matches pretty well, but we need to handle room_type_id vs embedded room_types
            // For now, returning raw data and letting component handle or mapping here.
            // Let's assume we map it to the Room interface manually if keys differ.
            // Based on schema: room_number (db) vs roomNumber (frontend)

            return data.map((item: Record<string, unknown> & { room_types?: Record<string, unknown> }) => ({
                id: item.id,
                roomNumber: item.room_number, // camelCase mapping
                roomTypeId: item.room_type_id,
                floor: item.floor,
                status: item.status,
                notes: item.notes,
                // We'll optionally attach the expanded type info if the UI needs it
                roomTypeName: item.room_types?.max_guests ? `${item.room_types.max_guests}p` : undefined,
                price: item.room_types?.base_price,
            })) as Room[];
        },
        staleTime: 2 * 60 * 1000,
    });
};
