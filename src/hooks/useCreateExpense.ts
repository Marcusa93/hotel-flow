import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseType } from '@/types/hotel';

interface CreateExpenseInput {
    date: Date;
    expenseType: ExpenseType;
    amount: number;
    description?: string;
}

export const useCreateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateExpenseInput): Promise<Expense> => {
            const { data, error } = await supabase
                .from('expenses')
                .insert({
                    date: input.date.toISOString().split('T')[0],
                    expense_type: input.expenseType,
                    amount: input.amount,
                    description: input.description || null
                })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                date: new Date(data.date),
                expenseType: data.expense_type as ExpenseType,
                amount: parseFloat(data.amount),
                description: data.description,
                createdAt: new Date(data.created_at)
            };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    });
};
