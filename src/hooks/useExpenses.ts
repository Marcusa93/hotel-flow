import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseType } from '@/types/hotel';

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

            return (data || []).map(row => ({
                id: row.id,
                date: new Date(row.date),
                expenseType: row.expense_type as ExpenseType,
                amount: parseFloat(row.amount),
                description: row.description,
                createdAt: new Date(row.created_at)
            }));
        }
    });
};
