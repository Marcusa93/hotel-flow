import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MinibarItem {
  id: string;
  name: string;
  category: 'bebida' | 'snack' | 'alcohol' | 'otro';
  price: number;
  isActive: boolean;
}

export const useMinibarItems = () => {
  return useQuery({
    queryKey: ['minibar-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('minibar_items')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category as MinibarItem['category'],
        price: Number(item.price),
        isActive: item.is_active,
      })) as MinibarItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateMinibarItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<MinibarItem, 'id' | 'isActive'>) => {
      const { data, error } = await supabase
        .from('minibar_items')
        .insert({
          name: item.name,
          category: item.category,
          price: item.price,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minibar-items'] });
    },
  });
};

export const useUpdateMinibarItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MinibarItem> & { id: string }) => {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;

      const { error } = await supabase
        .from('minibar_items')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minibar-items'] });
    },
  });
};
