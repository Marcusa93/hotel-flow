
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RoomType } from '@/types/hotel';

export const useRoomTypes = () => {
    return useQuery({
        queryKey: ['roomTypes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('room_types')
                .select('*')
                .order('name');

            if (error) throw error;

            return data.map((item: Record<string, unknown>) => ({
                id: item.id,
                name: item.name,
                basePrice: item.base_price, // map snake_case to camelCase
                maxGuests: item.max_guests,
                description: item.description
            })) as RoomType[];
        }
    });
};
