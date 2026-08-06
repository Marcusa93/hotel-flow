import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCashSession } from '@/lib/mappers';
import type { CashSession } from '@/types/hotel';

const QUERY_KEY = ['cash_sessions'] as const;

export const useCashSessions = () => {
  return useQuery<CashSession[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []).map(mapCashSession);
    },
    staleTime: 30 * 1000,
  });
};

interface OpenSessionParams {
  openingAmount: number;
  openedBy?: string;
  openedByName?: string;
  /** Permite abrir el turno desde una fecha pasada (retroactivo). */
  openedAt?: Date;
}

export const useOpenCashSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ openingAmount, openedBy, openedByName, openedAt }: OpenSessionParams) => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          opening_amount: openingAmount,
          opened_by: openedBy || null,
          opened_by_name: openedByName || null,
          // Si no viene, la DB usa NOW(). Si viene, permite abrir desde ayer o antes.
          ...(openedAt ? { opened_at: openedAt.toISOString() } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      return mapCashSession(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

interface CloseSessionParams {
  sessionId: string;
  closedBy?: string;
  closedByName?: string;
  notes?: string;
  snapCashIncome: number;
  snapCashExpenses: number;
  snapCashToDeposit: number;
  snapTotalIncome: number;
  snapTotalExpenses: number;
}

export const useCloseCashSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      closedBy,
      closedByName,
      notes,
      snapCashIncome,
      snapCashExpenses,
      snapCashToDeposit,
      snapTotalIncome,
      snapTotalExpenses,
    }: CloseSessionParams) => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: closedBy || null,
          closed_by_name: closedByName || null,
          notes: notes || null,
          snap_cash_income: snapCashIncome,
          snap_cash_expenses: snapCashExpenses,
          snap_cash_to_deposit: snapCashToDeposit,
          snap_total_income: snapTotalIncome,
          snap_total_expenses: snapTotalExpenses,
        })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return mapCashSession(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useReopenCashSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: null,
          closed_by: null,
          closed_by_name: null,
          snap_cash_income: null,
          snap_cash_expenses: null,
          snap_cash_to_deposit: null,
          snap_total_income: null,
          snap_total_expenses: null,
        })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return mapCashSession(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
