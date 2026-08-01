import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCashContribution } from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';
import { logAuditEvent } from './useCreateAuditLog';
import type { CashContribution } from '@/types/hotel';

/**
 * Los aportes de la empresa a la caja.
 *
 * Se traen todos y no por día: el saldo de esa caja es histórico —la plata que
 * pusieron el lunes sigue estando el miércoles— así que filtrar por fecha daría
 * un saldo equivocado.
 */
export const useCashContributions = () => {
  return useQuery<CashContribution[]>({
    queryKey: ['cashContributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_contributions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapCashContribution);
    },
  });
};

export interface CreateCashContributionParams {
  date: Date;
  amount: number;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
}

export const useCreateCashContribution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCashContributionParams) => {
      const { data, error } = await supabase
        .from('cash_contributions')
        .insert({
          date: formatLocalDate(params.date),
          amount: params.amount,
          notes: params.notes?.trim() || null,
          created_by: params.createdBy || null,
          created_by_name: params.createdByName || null,
        })
        .select()
        .single();

      if (error) throw error;

      return mapCashContribution(data);
    },
    onSuccess: (contribution) => {
      queryClient.invalidateQueries({ queryKey: ['cashContributions'] });

      logAuditEvent({
        entityType: 'expense',
        entityId: contribution.id,
        action: 'CREATE',
        description: `Aporte de la empresa a la caja: $${contribution.amount.toLocaleString('es-AR')}${contribution.notes ? ` — ${contribution.notes}` : ''}`,
        newValues: { amount: contribution.amount, date: formatLocalDate(contribution.date) },
      });
    },
  });
};

export const useDeleteCashContribution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contribution: CashContribution) => {
      const { error } = await supabase
        .from('cash_contributions')
        .delete()
        .eq('id', contribution.id);

      if (error) throw error;

      return contribution;
    },
    onSuccess: (contribution) => {
      queryClient.invalidateQueries({ queryKey: ['cashContributions'] });

      logAuditEvent({
        entityType: 'expense',
        entityId: contribution.id,
        action: 'DELETE',
        description: `Aporte eliminado: $${contribution.amount.toLocaleString('es-AR')}`,
        oldValues: { amount: contribution.amount },
      });
    },
  });
};
