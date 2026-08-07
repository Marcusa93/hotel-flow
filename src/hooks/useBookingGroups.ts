import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBookingGroup } from '@/lib/mappers';
import type { BookingGroup } from '@/types/hotel';

const QUERY_KEY = ['bookingGroups'] as const;

/** Las reservas masivas, de la más nueva a la más vieja. */
export const useBookingGroups = () =>
  useQuery<BookingGroup[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_groups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(mapBookingGroup);
    },
    staleTime: 60 * 1000,
  });

interface CreateGroupParams {
  guestId?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
}

/**
 * Abre la reserva masiva. Nace sin precio a propósito: lo pone administración.
 *
 * Devuelve el grupo para que quien llama le cuelgue las reservas de cada
 * habitación con su `groupId`.
 */
export const useCreateBookingGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guestId, notes, createdBy, createdByName }: CreateGroupParams) => {
      const { data, error } = await supabase
        .from('booking_groups')
        .insert({
          guest_id: guestId || null,
          notes: notes || null,
          created_by: createdBy || null,
          created_by_name: createdByName || null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapBookingGroup(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

/**
 * Le pone el precio al grupo y lo reparte entre sus habitaciones.
 *
 * Va por la función de la base y no por updates sueltos desde acá: son el grupo
 * más todas sus reservas, y si se corta en el medio queda un grupo tarifado con
 * la mitad de las habitaciones en cero — peor que no haberlo tarifado, porque ya
 * no aparece en la lista de pendientes. La función también rechaza a quien no
 * es administración.
 */
export const usePriceBookingGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      total,
      byName,
    }: {
      groupId: string;
      total: number;
      byName?: string;
    }) => {
      const { error } = await supabase.rpc('price_booking_group', {
        p_group_id: groupId,
        p_total: total,
        p_by_name: byName ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // El reparto reescribió el total de cada reserva del grupo.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};
