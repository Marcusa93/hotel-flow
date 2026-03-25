import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ExpenseType } from '@/types/hotel';
import { mapExpense } from '@/lib/mappers';

interface UseExpensesOptions {
    startDate?: Date;
    endDate?: Date;
    expenseType?: ExpenseType;
}

export const useExpenses = (options: UseExpensesOptions = {}) => {
    return useQuery({
        queryKey: ['expenses', options],
        queryFn: async (): Promise<Expense[]> => {
            let query = supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false });

            if (options.startDate) {
                query = query.gte('date', options.startDate.toISOString().split('T')[0]);
            }
            if (options.endDate) {
                query = query.lte('date', options.endDate.toISOString().split('T')[0]);
            }
            if (options.expenseType) {
                query = query.eq('expense_type', options.expenseType);
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map(mapExpense);
        },
        staleTime: 2 * 60 * 1000,
    });
};
