import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { OtherIncome } from '@/types/hotel';
import { mapOtherIncome, otherIncomeToRow } from '@/lib/mappers';

/** List external/additional income ("INGRESOS ADICIONALES O EXTERNOS"), newest first. */
export const useOtherIncome = () =>
  useQuery({
    queryKey: ['otherIncome'],
    queryFn: async (): Promise<OtherIncome[]> => {
      const { data, error } = await supabase
        .from('other_income')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapOtherIncome);
    },
    staleTime: 2 * 60 * 1000,
  });

export const useCreateOtherIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<OtherIncome, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('other_income')
        .insert(otherIncomeToRow(input))
        .select()
        .single();
      if (error) throw error;
      return mapOtherIncome(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['otherIncome'] });
      qc.invalidateQueries({ queryKey: ['revenueStats'] });
    },
  });
};

export const useDeleteOtherIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('other_income').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['otherIncome'] }),
  });
};
