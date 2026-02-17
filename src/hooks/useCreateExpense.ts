import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseType } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

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
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            logAuditEvent({
                entityType: 'expense',
                entityId: data.id,
                action: 'CREATE',
                description: `Gasto registrado: ${data.expenseType} $${data.amount}`,
                newValues: { expenseType: data.expenseType, amount: data.amount, description: data.description },
            });

            createNotificationIfEnabled({
                type: 'info',
                category: 'system',
                title: 'Gasto registrado',
                message: `${data.expenseType}: $${data.amount.toLocaleString('es-AR')}${data.description ? ` — ${data.description}` : ''}`,
                metadata: { expenseId: data.id, expenseType: data.expenseType, amount: data.amount },
            });
        }
    });
};
