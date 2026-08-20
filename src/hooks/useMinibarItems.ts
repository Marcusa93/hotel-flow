import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapMinibarItem, minibarItemToRow } from '@/lib/mappers';
import type { MinibarCategory, MinibarItem, MinibarItemInput } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

/**
 * Los productos de la heladera.
 *
 * La tabla se llama minibar_items desde abril y los cargos de reserva la
 * referencian, así que el nombre se queda. En pantalla es "Heladera".
 */

// Se sigue exportando desde acá: MinibarQuickAdd lo importa de este archivo.
export type { MinibarItem };

interface UseMinibarItemsOptions {
  /** Los dados de baja siguen en la lista de la pantalla de gestión. */
  includeInactive?: boolean;
}

export const useMinibarItems = ({ includeInactive = false }: UseMinibarItemsOptions = {}) => {
  return useQuery({
    queryKey: ['minibar-items', { includeInactive }],
    queryFn: async (): Promise<MinibarItem[]> => {
      let query = supabase.from('minibar_items').select('*');
      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query.order('category').order('name');
      if (error) throw error;

      return (data || []).map(mapMinibarItem);
    },
    // El stock cambia con cada venta, y quien vende necesita verlo al día.
    staleTime: 30 * 1000,
  });
};

export const useCreateMinibarItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      // Al dar de alta, estos tres no son opcionales: sin ellos el producto no
      // se puede ni mostrar ni vender.
      item: MinibarItemInput & { name: string; category: MinibarCategory; price: number },
    ): Promise<MinibarItem> => {
      const { data, error } = await supabase
        .from('minibar_items')
        .insert({ ...minibarItemToRow(item), is_active: true })
        .select()
        .single();

      if (error) throw error;
      return mapMinibarItem(data);
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['minibar-items'] });
      logAuditEvent({
        entityType: 'minibar_item',
        entityId: item.id,
        action: 'CREATE',
        description: `Producto de heladera creado: ${item.name} ($${item.price.toLocaleString('es-AR')})`,
        newValues: { name: item.name, price: item.price, cost: item.cost, staffPrice: item.staffPrice },
      });
    },
  });
};

export const useUpdateMinibarItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: MinibarItemInput & { id: string }): Promise<MinibarItem> => {
      const { data, error } = await supabase
        .from('minibar_items')
        .update(minibarItemToRow(updates))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapMinibarItem(data);
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['minibar-items'] });
      logAuditEvent({
        entityType: 'minibar_item',
        entityId: item.id,
        action: 'UPDATE',
        description: item.isActive
          ? `Producto de heladera editado: ${item.name}`
          : `Producto de heladera dado de baja: ${item.name}`,
        newValues: {
          name: item.name, price: item.price, cost: item.cost,
          staffPrice: item.staffPrice, isActive: item.isActive,
        },
      });
    },
  });
};
