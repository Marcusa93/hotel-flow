import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './useCreateAuditLog';

interface UpdateRoomTypeParams {
  id: string;
  data: {
    basePrice?: number;
    name?: string;
    maxGuests?: number;
    description?: string;
  };
}

export const useUpdateRoomType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateRoomTypeParams) => {
      const updates: Record<string, any> = {};

      if (data.basePrice !== undefined) updates.base_price = data.basePrice;
      if (data.name !== undefined) updates.name = data.name;
      if (data.maxGuests !== undefined) updates.max_guests = data.maxGuests;
      if (data.description !== undefined) updates.description = data.description;

      const { data: result, error } = await supabase
        .from('room_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      logAuditEvent({
        entityType: 'room',
        entityId: variables.id,
        action: 'UPDATE',
        description: `Tipo de habitación actualizado: ${data?.name || ''}`,
        newValues: variables.data,
      });
    },
  });
};
