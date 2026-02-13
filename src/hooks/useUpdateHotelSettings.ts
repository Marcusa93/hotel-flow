import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { hotelSettingsToRow } from '@/lib/mappers';
import type { HotelSettings } from '@/types/hotel';

export const useUpdateHotelSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HotelSettings> }) => {
      const row = hotelSettingsToRow(data);
      const { data: result, error } = await supabase
        .from('hotel_settings')
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelSettings'] });
    },
  });
};
