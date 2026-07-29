
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapRoom } from '@/lib/mappers';
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

            // Las columnas propias de la habitación las mapea mapRoom, que es el
            // único lugar donde se traduce una fila de rooms. Acá había una copia
            // a mano y se quedó atrás: las columnas de la habilitación de
            // limpieza existían en la base y nunca llegaban a la pantalla.
            // Lo que se agrega arriba es lo que no está en la fila: el tipo de
            // habitación viene embebido en esta consulta y en ninguna otra.
            return data.map((item: Record<string, unknown> & { room_types?: Record<string, unknown> }) => ({
                ...mapRoom(item),
                roomTypeName: item.room_types?.max_guests ? `${item.room_types.max_guests}p` : undefined,
                price: item.room_types?.base_price,
            })) as Room[];
        },
        staleTime: 2 * 60 * 1000,
    });
};
