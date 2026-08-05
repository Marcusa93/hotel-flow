import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCashClosing } from '@/lib/mappers';
import { closingForDay } from '@/lib/cashClosing';
import { formatLocalDate } from '@/lib/utils';
import { logAuditEvent } from './useCreateAuditLog';
import type { CashClosing } from '@/types/hotel';

/** Todos los cierres. Son uno por día: la lista entera es chica. */
export const useCashClosings = () => {
  return useQuery<CashClosing[]>({
    queryKey: ['cashClosings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_closings')
        .select('*')
        .order('closing_date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapCashClosing);
    },
  });
};

/** El cierre de un día puntual, si existe. */
export const useClosingForDay = (day: string) => {
  const { data = [], isLoading } = useCashClosings();
  return {
    closing: closingForDay(data, day),
    isLoading,
  };
};

export interface CloseCashDayParams {
  /** 'YYYY-MM-DD' */
  day: string;
  cashIncome: number;
  cashFloat: number;
  cashExpenses: number;
  cashToDeposit: number;
  totalIncome: number;
  totalExpenses: number;
  notes?: string;
  closedBy?: string;
  closedByName?: string;
}

/**
 * Cierra el día, guardando los números tal como están en este momento.
 *
 * Es un upsert por fecha: si el día ya tenía un cierre reabierto, volver a
 * cerrarlo pisa el corte viejo y limpia la marca de reabierto. La fecha es UNIQUE
 * en la base, así que dos personas cerrando a la vez no dejan dos cortes.
 */
export const useCloseCashDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CloseCashDayParams) => {
      const { data, error } = await supabase
        .from('cash_closings')
        .upsert(
          {
            closing_date: params.day,
            cash_income: params.cashIncome,
            cash_float: params.cashFloat,
            cash_expenses: params.cashExpenses,
            cash_to_deposit: params.cashToDeposit,
            total_income: params.totalIncome,
            total_expenses: params.totalExpenses,
            notes: params.notes?.trim() || null,
            closed_at: new Date().toISOString(),
            closed_by: params.closedBy || null,
            closed_by_name: params.closedByName || null,
            // Volver a cerrar borra la marca de reabierto: el día vuelve a estar firme.
            reopened_at: null,
            reopened_by: null,
            reopened_by_name: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'closing_date' }
        )
        .select()
        .single();

      if (error) throw error;

      return mapCashClosing(data);
    },
    onSuccess: (closing) => {
      queryClient.invalidateQueries({ queryKey: ['cashClosings'] });

      logAuditEvent({
        entityType: 'cash_closing',
        entityId: closing.id,
        action: 'CREATE',
        description: `Caja del ${formatLocalDate(closing.closingDate)} cerrada — a rendir $${closing.cashToDeposit.toLocaleString('es-AR')}`,
        newValues: {
          cashIncome: closing.cashIncome,
          cashExpenses: closing.cashExpenses,
          cashToDeposit: closing.cashToDeposit,
        },
      });
    },
  });
};

export interface ReopenCashDayParams {
  closing: CashClosing;
  reopenedBy?: string;
  reopenedByName?: string;
}

/**
 * Reabre un día cerrado. Solo administración; la política de la base lo exige.
 *
 * No borra la fila: deja el rastro de que alguien lo abrió y cuándo. El corte
 * guardado se conserva hasta que se vuelva a cerrar.
 */
export const useReopenCashDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closing, reopenedBy, reopenedByName }: ReopenCashDayParams) => {
      const { data, error } = await supabase
        .from('cash_closings')
        .update({
          reopened_at: new Date().toISOString(),
          reopened_by: reopenedBy || null,
          reopened_by_name: reopenedByName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', closing.id)
        .select()
        .single();

      if (error) throw error;

      return mapCashClosing(data);
    },
    onSuccess: (closing) => {
      queryClient.invalidateQueries({ queryKey: ['cashClosings'] });

      logAuditEvent({
        entityType: 'cash_closing',
        entityId: closing.id,
        action: 'STATUS_CHANGE',
        description: `Caja del ${formatLocalDate(closing.closingDate)} reabierta`,
        oldValues: { cashToDeposit: closing.cashToDeposit },
      });
    },
  });
};
