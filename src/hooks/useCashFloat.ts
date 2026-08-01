import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCashFloat } from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';
import { logAuditEvent } from './useCreateAuditLog';
import type { CashFloat } from '@/types/hotel';

/**
 * El fondo fijo de cada día. Una fila por día como mucho, así que se traen todas
 * y se resuelve en memoria: el hotel cierra una caja por día y la tabla crece un
 * renglón por jornada.
 */
export const useCashFloats = () => {
  return useQuery<CashFloat[]>({
    queryKey: ['cashFloats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_floats')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapCashFloat);
    },
  });
};

/** El monto fijado para un día puntual, o null si ese día nunca se tocó. */
export const useCashFloatForDay = (day: string): number | null => {
  const { data = [] } = useCashFloats();
  const match = data.find(f => formatLocalDate(f.date) === day);
  return match ? match.amount : null;
};

export interface SetCashFloatParams {
  /** 'YYYY-MM-DD' */
  day: string;
  amount: number;
  setBy?: string;
  setByName?: string;
}

export const useSetCashFloat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ day, amount, setBy, setByName }: SetCashFloatParams) => {
      // Upsert por fecha: la fecha es la clave primaria, así que fijar dos veces
      // el mismo día corrige en vez de duplicar.
      const { data, error } = await supabase
        .from('cash_floats')
        .upsert(
          {
            date: day,
            amount,
            set_by: setBy || null,
            set_by_name: setByName || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'date' }
        )
        .select()
        .single();

      if (error) throw error;

      return mapCashFloat(data);
    },
    onSuccess: (cashFloat) => {
      queryClient.invalidateQueries({ queryKey: ['cashFloats'] });

      logAuditEvent({
        entityType: 'hotel_settings',
        entityId: formatLocalDate(cashFloat.date),
        action: 'UPDATE',
        description: `Fondo fijo del ${formatLocalDate(cashFloat.date)}: $${cashFloat.amount.toLocaleString('es-AR')}`,
        newValues: { amount: cashFloat.amount },
      });
    },
  });
};
