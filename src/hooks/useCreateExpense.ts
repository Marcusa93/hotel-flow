import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CashSource, Expense, ExpenseType, SettlementMethod } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import { formatLocalDate } from '@/lib/utils';

interface CreateExpenseInput {
    date: Date;
    expenseType: ExpenseType;
    amount: number;
    description?: string;
    /** Con qué se pagó. Sin esto la caja no cuadra: un gasto en efectivo sale del cajón. */
    method?: SettlementMethod;
    /** De cuál de las dos cajas salió, con cualquier medio de pago. */
    cashSource?: CashSource;
}

export const useCreateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateExpenseInput): Promise<Expense> => {
            const { data, error } = await supabase
                .from('expenses')
                .insert({
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
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                date: new Date(data.date),
                expenseType: data.expense_type as ExpenseType,
                amount: parseFloat(data.amount),
                description: data.description,
                method: data.method || undefined,
                cashSource: data.cash_source || undefined,
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
