import { describe, it, expect } from 'vitest';
import { expenseSchema } from '@/components/expenses/NewExpenseDialog';
import { formatLocalDate, parseLocalDate } from '@/lib/utils';

// Un gasto cargado el 3 de agosto se guardaba con fecha 2 y no aparecía en el
// cierre de caja del día. El formulario armaba la fecha en UTC (medianoche del
// 3 en Greenwich son las 21 del 2 en Argentina) y el hook la escribía leyendo
// el calendario local. Dos criterios distintos en el mismo camino.

const gasto = (date: string) => expenseSchema.safeParse({
    date,
    expenseType: 'SUPERMERCADO',
    amount: 70000,
    method: 'CASH',
    cashSource: 'EMPRESA',
});

describe('fecha del gasto', () => {
    it('guarda el día que se eligió en el formulario', () => {
        const parsed = gasto('2026-08-03');
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(formatLocalDate(parsed.data.date)).toBe('2026-08-03');
    });

    it('no se corre en ningún mes del año', () => {
        // 2025 entero: meses ya pasados, para que no choque con el rechazo de
        // fechas futuras y se pruebe igual el cambio de mes en los 12.
        for (let mes = 0; mes < 12; mes++) {
            const dia = formatLocalDate(new Date(2025, mes, 1));
            const parsed = gasto(dia);
            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(formatLocalDate(parsed.data.date)).toBe(dia);
        }
    });

    it('sigue rechazando una fecha futura', () => {
        const manana = formatLocalDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
        expect(gasto(manana).success).toBe(false);
    });

    it('acepta el día de hoy hasta la última hora', () => {
        expect(gasto(formatLocalDate(new Date())).success).toBe(true);
    });
});

describe('parseLocalDate', () => {
    it('es la inversa de formatLocalDate', () => {
        expect(formatLocalDate(parseLocalDate('2026-08-03'))).toBe('2026-08-03');
        expect(formatLocalDate(parseLocalDate('2026-01-01'))).toBe('2026-01-01');
        expect(formatLocalDate(parseLocalDate('2026-12-31'))).toBe('2026-12-31');
    });

    it('deja pasar un Date sin tocarlo', () => {
        const d = new Date(2026, 7, 3, 15, 30);
        expect(parseLocalDate(d)).toBe(d);
    });
});
