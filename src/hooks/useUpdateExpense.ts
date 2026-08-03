import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CashSource, ExpenseType, SettlementMethod } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { formatLocalDate } from '@/lib/utils';

interface UpdateExpenseInput {
    id: string;
    date: Date;
    expenseType: ExpenseType;
    amount: number;
    description?: string;
    method?: SettlementMethod;
    /** Solo cuando se pagó en efectivo: de cuál de las dos cajas salió. */
    cashSource?: CashSource;
}

export const useUpdateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: UpdateExpenseInput) => {
            const { data, error } = await supabase
                .from('expenses')
                .update({
                    // Mismo criterio que el alta: el día es el del calendario
                    // local. toISOString() acá restaba un día.
                    date: formatLocalDate(input.date),
                    expense_type: input.expenseType,
                    amount: input.amount,
                    description: input.description || null,
                    method: input.method || null,
                    // Solo tiene sentido en efectivo: una transferencia no sale
                    // de ninguna de las dos cajas.
                    cash_source: input.method === 'CASH' ? input.cashSource || 'RECAUDACION' : null,
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
