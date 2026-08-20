import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCreateExpense } from '@/hooks/useCreateExpense';
import { useUpdateExpense } from '@/hooks/useUpdateExpense';
import { expenseSchema } from '@/components/expenses/NewExpenseDialog';
import { belongsToDailyCash, expenseSource } from '@/lib/cashClosing';
import type { SettlementMethod } from '@/types/hotel';

// El dueño pagó la luz por transferencia, marcó "Caja de la empresa" y el gasto
// apareció en el cierre de caja de recepción de ese día.
//
// De qué caja sale un gasto dejó de depender de con qué se pagó: la base lo dice
// así (COMMENT de expenses.cash_source, y sus políticas leen null como
// RECAUDACION) y la lectura también (expenseSource). Los hooks de escritura
// habían quedado atrás: guardaban null cuando el método no era efectivo, y ese
// null se lee RECAUDACION. Lo que administración imputaba a la empresa terminaba
// en el cajón del día.

/** Lo último que se le mandó a la base. */
let payload: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase', () => {
    const single = () => Promise.resolve({
        data: {
            id: 'e-1',
            date: (payload?.date as string) ?? '2026-08-20',
            expense_type: payload?.expense_type,
            amount: payload?.amount,
            description: payload?.description ?? null,
            method: payload?.method ?? null,
            cash_source: payload?.cash_source ?? null,
            created_at: '2026-08-20T12:00:00Z',
        },
        error: null,
    });
    const devuelve = (p: Record<string, unknown>) => {
        payload = p;
        return { select: () => ({ single, eq: () => ({ single }) }), eq: () => ({ select: () => ({ single }) }) };
    };
    return {
        supabase: {
            from: () => ({ insert: devuelve, update: devuelve }),
        },
    };
});

vi.mock('@/hooks/useCreateAuditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('@/hooks/useCreateNotification', () => ({ createNotificationIfEnabled: vi.fn() }));

const envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

const LA_LUZ = {
    date: new Date(2026, 7, 20),
    expenseType: 'SERVICIOS' as const,
    amount: 300_000,
    description: 'Luz de agosto',
};

/** Los métodos que no son efectivo: los que el bug vaciaba. */
const NO_EFECTIVO: SettlementMethod[] = ['TRANSFER', 'DEBIT', 'CREDIT', 'QR', 'CHEQUE', 'OTHER'];

beforeEach(() => { payload = null; });

describe('de qué caja sale el gasto, al guardarlo', () => {
    it.each(NO_EFECTIVO)('imputa a la empresa un gasto pagado con %s', async (method) => {
        const { result } = renderHook(() => useCreateExpense(), { wrapper: envoltorio });
        await result.current.mutateAsync({ ...LA_LUZ, method, cashSource: 'EMPRESA' });
        await waitFor(() => expect(payload).not.toBeNull());
        expect(payload?.cash_source).toBe('EMPRESA');
    });

    it('sigue imputando al cajón lo que sale de la recaudación', async () => {
        const { result } = renderHook(() => useCreateExpense(), { wrapper: envoltorio });
        await result.current.mutateAsync({ ...LA_LUZ, method: 'TRANSFER', cashSource: 'RECAUDACION' });
        expect(payload?.cash_source).toBe('RECAUDACION');
    });

    it('el gasto en efectivo de la empresa no cambió', async () => {
        const { result } = renderHook(() => useCreateExpense(), { wrapper: envoltorio });
        await result.current.mutateAsync({ ...LA_LUZ, method: 'CASH', cashSource: 'EMPRESA' });
        expect(payload?.cash_source).toBe('EMPRESA');
    });

    it('sin elegir caja se supone la recaudación, como los gastos viejos', async () => {
        const { result } = renderHook(() => useCreateExpense(), { wrapper: envoltorio });
        await result.current.mutateAsync({ ...LA_LUZ, method: 'CASH' });
        expect(payload?.cash_source).toBe('RECAUDACION');
    });

    it('corregir el gasto tampoco le borra la caja', async () => {
        const { result } = renderHook(() => useUpdateExpense(), { wrapper: envoltorio });
        await result.current.mutateAsync({ id: 'e-1', ...LA_LUZ, method: 'TRANSFER', cashSource: 'EMPRESA' });
        expect(payload?.cash_source).toBe('EMPRESA');
    });

    it('lo guardado queda fuera del cierre de recepción', async () => {
        const { result } = renderHook(() => useCreateExpense(), { wrapper: envoltorio });
        const guardado = await result.current.mutateAsync({ ...LA_LUZ, method: 'TRANSFER', cashSource: 'EMPRESA' });
        expect(expenseSource(guardado)).toBe('EMPRESA');
        expect(belongsToDailyCash(guardado)).toBe(false);
    });
});

describe('con qué se pagó el gasto', () => {
    it('acepta el cheque, que el desplegable ofrece y la base guarda', () => {
        const parsed = expenseSchema.safeParse({
            date: '2026-08-20',
            expenseType: 'SERVICIOS',
            amount: 300_000,
            method: 'CHEQUE',
            cashSource: 'EMPRESA',
        });
        expect(parsed.success).toBe(true);
    });
});
