import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBookingCharge } from '@/lib/mappers';

/**
 * Todos los cargos, para las pantallas que muestran muchas reservas juntas.
 *
 * useBookingCharges trae los de una sola reserva y sirve para el detalle. El
 * tablero, la tabla y el panel del día necesitan los de todas al mismo tiempo:
 * pedirlos de a uno serían tantas consultas como reservas en pantalla.
 *
 * La clave comparte prefijo con la del detalle a propósito. Crear o borrar un
 * cargo invalida ['bookingCharges'] y react-query, que matchea por prefijo,
 * refresca las dos: si no, agregar un consumo desde el detalle dejaba el badge
 * del tablero mostrando el estado viejo.
 */
export const useAllBookingCharges = () => {
    return useQuery({
        queryKey: ['bookingCharges', 'all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('booking_charges')
                .select('*');

            if (error) throw error;
            return (data || []).map(mapBookingCharge);
        },
        staleTime: 2 * 60 * 1000,
    });
};
