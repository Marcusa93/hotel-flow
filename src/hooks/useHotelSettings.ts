import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapHotelSettings } from '@/lib/mappers';

export const useHotelSettings = () => {
  return useQuery({
    queryKey: ['hotelSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapHotelSettings(data);
    },
    staleTime: 5 * 60 * 1000,
  });
};
