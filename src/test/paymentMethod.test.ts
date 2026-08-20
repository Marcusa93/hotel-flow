import { describe, it, expect } from 'vitest';
import {
    CORRECTABLE_PAYMENT_METHODS,
    describePaymentMethodChange,
    paymentMethodSchema,
    resolvePaymentMethodChange,
} from '@/lib/paymentMethod';
import { formatLocalDate } from '@/lib/utils';
import type { CashClosing, CashSession, Payment, SettlementMethod } from '@/types/hotel';

// Recepción cobra en efectivo y toca QR. El cobro queda cargado con el método
// equivocado, el desglose del cierre miente, y hasta acá la única salida era
// marcarlo Reembolsado y volver a cargarlo.
//
// Lo que se prueba acá es cuándo la corrección se puede hacer y qué mueve. La
// regla que importa: con la caja cerrada no se toca, porque el corte que se
// guarda al cerrar NO incluye el desglose por método y nada detectaría el cambio.

const A_LAS_NUEVE = (dias: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(9, 30, 0, 0);
    return d;
};

const AYER = A_LAS_NUEVE(1);

const cobro = (over: Partial<Payment> = {}): Payment => ({
    id: 'p-1',
    bookingId: 'b-1',
    date: AYER,
    method: 'QR',
    status: 'PAID',
    amount: 85_000,
    ...over,
});

const cierre = (day: Date, over: Partial<CashClosing> = {}): CashClosing => ({
    id: `c-${formatLocalDate(day)}`,
    closingDate: day,
    cashIncome: 0, cashFloat: 0, cashExpenses: 0, cashToDeposit: 0,
    totalIncome: 0, totalExpenses: 0,
    closedAt: new Date(), createdAt: new Date(),
    ...over,
});

const turno = (openedAt: Date, closedAt?: Date): CashSession => ({
    id: `s-${openedAt.getTime()}`,
    openedAt,
    openingAmount: 0,
    closedAt,
    createdAt: openedAt,
});

/** El veredicto de mover este cobro a `target`, con las cajas que se le pasen. */
const resolver = (
    target: SettlementMethod,
    { payment = cobro(), closings = [], sessions = [] }: {
        payment?: Payment;
        closings?: CashClosing[];
        sessions?: CashSession[];
    } = {}
) => resolvePaymentMethodChange({ payment, targetMethod: target, closings, sessions });

describe('los métodos entre los que se puede corregir', () => {
    it('no ofrece la cuenta corriente', () => {
        // No es una forma de pagar: es que no entró plata. Moverla cambia el saldo
        // del huésped, no el renglón del cierre.
        expect(CORRECTABLE_PAYMENT_METHODS).not.toContain('CUENTA_CORRIENTE');
    });

    it('ofrece los siete que sí son formas de pagar', () => {
        expect(CORRECTABLE_PAYMENT_METHODS).toEqual(
            ['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QR', 'CHEQUE', 'OTHER']
        );
    });

    it('arranca por el efectivo, que es el destino más frecuente', () => {
        expect(CORRECTABLE_PAYMENT_METHODS[0]).toBe('CASH');
    });

    it('el schema rechaza la cuenta corriente y acepta el resto', () => {
        expect(paymentMethodSchema.safeParse('CUENTA_CORRIENTE').success).toBe(false);
        for (const m of CORRECTABLE_PAYMENT_METHODS) {
            expect(paymentMethodSchema.safeParse(m).success).toBe(true);
        }
    });
});

describe('cuándo se puede corregir', () => {
    it('con la caja abierta, se puede', () => {
        expect(resolver('CASH').verdict).toBe('LIBRE');
    });

    it('elegir el que ya tiene no es una corrección', () => {
        expect(resolver('QR').verdict).toBe('SIN_CAMBIO');
    });

    it('un cargo a cuenta corriente no se corrige por acá', () => {
        const verdict = resolver('CASH', {
            payment: cobro({ method: 'CUENTA_CORRIENTE' }),
        }).verdict;
        expect(verdict).toBe('CUENTA_CORRIENTE');
    });

    it('la cuenta corriente se rechaza incluso con la caja cerrada', () => {
        // El orden importa: primero se mira qué es el cobro y después dónde está.
        // Al revés, el mostrador leería "reabrí la caja" para algo que no se
        // puede hacer ni con la caja abierta.
        const change = resolver('CASH', {
            payment: cobro({ method: 'CUENTA_CORRIENTE' }),
            closings: [cierre(AYER)],
        });
        expect(change.verdict).toBe('CUENTA_CORRIENTE');
    });

    it('con el día ya firmado, no se puede', () => {
        const change = resolver('CASH', { closings: [cierre(AYER)] });
        expect(change.verdict).toBe('BLOQUEADO');
        expect(change.closedDays).toEqual([formatLocalDate(AYER)]);
    });

    it('si el día se reabrió, se puede otra vez', () => {
        const change = resolver('CASH', {
            closings: [cierre(AYER, { reopenedAt: new Date() })],
        });
        expect(change.verdict).toBe('LIBRE');
    });

    it('el cierre de OTRO día no bloquea', () => {
        expect(resolver('CASH', { closings: [cierre(A_LAS_NUEVE(5))] }).verdict).toBe('LIBRE');
    });

    it('con el turno que contiene el cobro ya cerrado, no se puede', () => {
        // Es el sistema vigente: el día puede no tener cash_closings y el cobro
        // estar rendido igual.
        const change = resolver('CASH', {
            sessions: [turno(A_LAS_NUEVE(2), A_LAS_NUEVE(0))],
        });
        expect(change.verdict).toBe('BLOQUEADO');
    });

    it('con el turno todavía abierto, se puede', () => {
        expect(resolver('CASH', { sessions: [turno(A_LAS_NUEVE(2))] }).verdict).toBe('LIBRE');
    });

    it('un turno cerrado que no contiene el cobro no bloquea', () => {
        const change = resolver('CASH', {
            sessions: [turno(A_LAS_NUEVE(9), A_LAS_NUEVE(8))],
        });
        expect(change.verdict).toBe('LIBRE');
    });

    it('bloquea también los cambios que no tocan el efectivo', () => {
        // A propósito: "con la caja cerrada no se toca" se explica en una frase.
        // Y el desglose por método no queda en el corte, así que QR a
        // transferencia reescribe el cierre impreso sin dejar rastro en ningún
        // total.
        const change = resolver('TRANSFER', { closings: [cierre(AYER)] });
        expect(change.verdict).toBe('BLOQUEADO');
        expect(change.movesCash).toBe(false);
    });
});

describe('qué mueve la corrección', () => {
    it('entrar al efectivo mueve el efectivo a rendir', () => {
        expect(resolver('CASH').movesCash).toBe(true);
    });

    it('salir del efectivo también', () => {
        expect(resolver('QR', { payment: cobro({ method: 'CASH' }) }).movesCash).toBe(true);
    });

    it('entre dos métodos que no son efectivo, no lo mueve', () => {
        expect(resolver('TRANSFER').movesCash).toBe(false);
        expect(resolver('DEBIT', { payment: cobro({ method: 'CREDIT' }) }).movesCash).toBe(false);
    });

    it('entrar o salir del cheque mueve el papel del mostrador', () => {
        expect(resolver('CHEQUE').movesCheque).toBe(true);
        expect(resolver('CASH', { payment: cobro({ method: 'CHEQUE' }) }).movesCheque).toBe(true);
        expect(resolver('TRANSFER').movesCheque).toBe(false);
    });

    it('sin corrección no se mueve nada', () => {
        // Los avisos de la pantalla cuelgan de estas dos banderas: prendidas con
        // SIN_CAMBIO o CUENTA_CORRIENTE avisarían de un movimiento que no existe.
        const sinCambio = resolver('QR');
        expect(sinCambio.movesCash).toBe(false);
        expect(sinCambio.movesCheque).toBe(false);

        const ctaCte = resolver('CASH', { payment: cobro({ method: 'CUENTA_CORRIENTE' }) });
        expect(ctaCte.movesCash).toBe(false);
        expect(ctaCte.movesCheque).toBe(false);
    });

    it('el cobro no cambia de día: la corrección toca una caja, no dos', () => {
        expect(resolver('CASH').day).toBe(formatLocalDate(AYER));
    });
});

describe('el rastro que queda en auditoría', () => {
    it('dice de qué método a qué método, cuánto y de qué día', () => {
        const change = resolver('CASH');
        const texto = describePaymentMethodChange({ change, payment: cobro() });
        expect(texto).toContain('QR');
        expect(texto).toContain('Efectivo');
        expect(texto).toContain('85.000');
        // Con año: es lo que permite ubicar el movimiento meses después.
        expect(texto).toContain(formatLocalDate(AYER).split('-').reverse().join('/'));
    });

    it('usa las etiquetas de pantalla y no los códigos de la base', () => {
        // Quien lee auditoría está buscando por qué una caja dio distinto: "CASH"
        // ahí adentro obliga a traducir de memoria.
        const change = resolver('TRANSFER', { payment: cobro({ method: 'CHEQUE' }) });
        const texto = describePaymentMethodChange({ change, payment: cobro() });
        expect(texto).toContain('Cheque');
        expect(texto).toContain('Transferencia');
        expect(texto).not.toContain('CHEQUE');
        expect(texto).not.toContain('TRANSFER');
    });
});
