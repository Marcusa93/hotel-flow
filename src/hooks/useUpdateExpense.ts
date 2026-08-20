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
    /** De cuál de las dos cajas salió, con cualquier medio de pago. */
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
                    // De qué caja salió NO depende de con qué se pagó: la luz
                    // pagada por transferencia sale de la caja de la empresa
                    // igual que el súper en efectivo. Cuando esto miraba el
                    // método, el gasto que administración imputaba a la empresa
                    // se guardaba en null —que se lee RECAUDACION— y aparecía en
                    // el cierre de recepción de ese día.
                    cash_source: input.cashSource || 'RECAUDACION',
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
