import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ExpenseType } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

interface UpdateExpenseInput {
    id: string;
    date: Date;
    expenseType: ExpenseType;
    amount: number;
    description?: string;
}

export const useUpdateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: UpdateExpenseInput) => {
            const { data, error } = await supabase
                .from('expenses')
                .update({
                    date: input.date.toISOString().split('T')[0],
                    expense_type: input.expenseType,
                    amount: input.amount,
                    description: input.description || null,
                })
                .eq('id', input.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            logAuditEvent({
                entityType: 'expense',
                entityId: variables.id,
                action: 'UPDATE',
                description: `Gasto actualizado: ${variables.expenseType} $${variables.amount}`,
                newValues: { expenseType: variables.expenseType, amount: variables.amount },
            });
        },
    });
};
