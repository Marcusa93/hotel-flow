import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditPaymentMethodDialog } from '@/components/payments/EditPaymentMethodDialog';
import { formatLocalDate } from '@/lib/utils';
import type { CashClosing, CashSession, Payment } from '@/types/hotel';

// Lo que recepción ve al corregirle el medio de pago a un cobro. Las reglas están
// cubiertas en paymentMethod.test.ts; acá se verifica que el diálogo las respete:
// que muestre cómo queda antes de guardar, que avise cuando la corrección mueve
// el efectivo que se cuenta a mano, que pida confirmar, que no deje tocar una
// caja cerrada, y que lo que mande a la base sea SOLO el método.

const mutateAsync = vi.fn();
const refetch = vi.fn();
const refetchSessions = vi.fn();
let cierres: CashClosing[] = [];
let turnos: CashSession[] = [];

vi.mock('@/hooks/useCashClosings', () => ({
    useCashClosings: () => ({ data: cierres, isLoading: false, refetch }),
}));

vi.mock('@/hooks/useCashSessions', () => ({
    useCashSessions: () => ({ data: turnos, isLoading: false, refetch: refetchSessions }),
}));

vi.mock('@/hooks/useUpdatePayment', () => ({
    useUpdatePayment: () => ({ mutateAsync }),
}));

const diaAtras = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(9, 30, 0, 0);
    return d;
};

const AYER = diaAtras(1);
const ANTEAYER = diaAtras(2);

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

const abrir = (payment = cobro()) =>
    render(<EditPaymentMethodDialog open onOpenChange={vi.fn()} payment={payment} />);

const boton = (re: RegExp) => screen.getByRole('button', { name: re });

/**
 * Elige un método del desplegable.
 *
 * El Select de Radix no es un <select> nativo, así que no se le puede hacer
 * fireEvent.change: hay que abrirlo y clickear la opción, que es lo que hace el
 * recepcionista. Se apunta al `option` por rol para no agarrar el texto que el
 * trigger ya muestra.
 */
const elegirMetodo = async (nombre: RegExp) => {
    fireEvent.click(screen.getByRole('combobox'));
    const opcion = await screen.findByRole('option', { name: nombre });
    fireEvent.click(opcion);
};

beforeEach(() => {
    cierres = [];
    turnos = [];
    mutateAsync.mockReset().mockResolvedValue({ auditOk: true });
    refetch.mockReset().mockImplementation(() => Promise.resolve({ data: cierres }));
    refetchSessions.mockReset().mockImplementation(() => Promise.resolve({ data: turnos }));
});

describe('el diálogo de corregir medio de pago', () => {
    it('abre con el método que el cobro tiene hoy', () => {
        abrir();
        expect(screen.getByRole('combobox')).toHaveTextContent(/QR/);
    });

    it('sin elegir otro método no deja guardar', () => {
        abrir();
        expect(boton(/elegí otro medio de pago/i)).toBeDisabled();
    });

    it('aclara que el cobro no cambia de día', () => {
        // Es la confusión más probable entre los dos diálogos hermanos.
        abrir();
        expect(screen.getByText(/no de qué día es/i)).toBeInTheDocument();
    });

    it('muestra de qué método a qué método queda', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText('QR')).toBeInTheDocument();
        expect(boton(/cambiar a efectivo/i)).toBeEnabled();
    });

    it('pide confirmar antes de tocar la plata', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);

        fireEvent.click(boton(/^cambiar a/i));

        expect(mutateAsync).not.toHaveBeenCalled();
        expect(await screen.findByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    });

    it('manda SOLO el método, con la guarda contra pisar al otro', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);

        fireEvent.click(boton(/^cambiar a/i));
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

        const args = mutateAsync.mock.calls[0][0];
        // Ni la fecha ni el monto ni el estado viajan: son otros daños contables.
        expect(Object.keys(args.data)).toEqual(['method']);
        expect(args.data.method).toBe('CASH');
        expect(args.expectedMethod).toBe('QR');
        expect(args.expectedDate).toBeUndefined();
    });

    it('deja el rastro con los dos métodos, el día y el monto', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);
        fireEvent.click(boton(/^cambiar a/i));
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());

        const { audit } = mutateAsync.mock.calls[0][0];
        expect(audit.description).toMatch(/recategorizado de QR a Efectivo — \$85\.000/);
        // Etiquetas y no códigos: auditoría imprime el valor crudo del JSONB.
        expect(audit.oldValues.metodo).toBe('QR');
        expect(audit.newValues.metodo).toBe('Efectivo');
        expect(audit.metadata.mueveEfectivo).toBe(true);
    });

    it('cambiar de método otra vez vuelve a pedir confirmación', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);
        fireEvent.click(boton(/^cambiar a/i));
        await screen.findByRole('button', { name: /confirmar/i });

        await elegirMetodo(/^Transferencia/);

        expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
    });
});

describe('el aviso de que se mueve el efectivo', () => {
    it('avisa que el efectivo a rendir sube al pasar a efectivo', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText(/sube/i)).toBeInTheDocument();
        expect(screen.getByText(/tiene que estar en el cajón/i)).toBeInTheDocument();
    });

    it('avisa que baja al salir del efectivo, y que va a dar sobrante', async () => {
        abrir(cobro({ method: 'CASH' }));
        await elegirMetodo(/^QR/);

        expect(screen.getByText(/baja/i)).toBeInTheDocument();
        expect(screen.getByText(/sobrante/i)).toBeInTheDocument();
    });

    it('entre dos métodos que no son efectivo dice que no cambia', async () => {
        abrir();
        await elegirMetodo(/^Transferencia/);

        expect(screen.getByText(/el efectivo a rendir no cambia/i)).toBeInTheDocument();
        expect(screen.queryByText(/tiene que estar en el cajón/i)).not.toBeInTheDocument();
    });

    it('avisa por el papel del cheque, que se entrega a mano', async () => {
        abrir();
        await elegirMetodo(/^Cheque/);

        expect(screen.getByText(/tiene que estar el papel/i)).toBeInTheDocument();
    });
});

describe('cuando la caja ya está cerrada', () => {
    it('no deja corregir un cobro de un día ya rendido', async () => {
        cierres = [cierre(AYER)];
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText(/ya está cerrada y rendida/i)).toBeInTheDocument();
        expect(boton(/^cambiar a/i)).toBeDisabled();
    });

    it('explica que el desglose por método no queda guardado en el cierre', async () => {
        // Es la razón de fondo del bloqueo, y la que justifica que sea prohibición
        // y no aviso: nada detectaría el cambio después.
        cierres = [cierre(AYER)];
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText(/no queda guardado en el/i)).toBeInTheDocument();
    });

    it('desaconseja el reembolso, que es el atajo que rompe todo', async () => {
        cierres = [cierre(AYER)];
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText(/no marques el cobro como reembolsado/i)).toBeInTheDocument();
    });

    it('un día reabierto vuelve a dejarse tocar', async () => {
        cierres = [cierre(AYER, { reopenedAt: new Date() })];
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(boton(/^cambiar a/i)).toBeEnabled();
    });

    it('el turno cerrado bloquea aunque no haya cierre por día', async () => {
        turnos = [turno(ANTEAYER, new Date())];
        abrir();
        await elegirMetodo(/^Efectivo/);

        expect(screen.getByText(/ya está cerrada y rendida/i)).toBeInTheDocument();
        expect(boton(/^cambiar a/i)).toBeDisabled();
    });

    it('si se cierra mientras el diálogo está abierto, no manda nada', async () => {
        abrir();
        await elegirMetodo(/^Efectivo/);
        fireEvent.click(boton(/^cambiar a/i));

        // Se cierra la caja entre la confirmación y el submit: la relectura la
        // tiene que ver. Sin esto alcanzaba con entrar a Cobros con el caché frío.
        cierres = [cierre(AYER)];
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});

describe('cuando el cobro es un cargo a cuenta corriente', () => {
    it('no ofrece corregir nada: no hubo medio de pago', () => {
        abrir(cobro({ method: 'CUENTA_CORRIENTE' }));

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText(/no entró plata a ninguna caja/i)).toBeInTheDocument();
    });

    it('manda al camino que sí existe', () => {
        abrir(cobro({ method: 'CUENTA_CORRIENTE' }));

        expect(screen.getByText(/registralo desde su cuenta corriente/i)).toBeInTheDocument();
        expect(boton(/entendido/i)).toBeInTheDocument();
    });

    it('con la caja cerrada dice lo mismo, no "reabri la caja"', () => {
        // El orden del veredicto importa: primero qué es el cobro, después dónde
        // está. Al revés, el mostrador leería que hay que reabrir la caja para
        // algo que no se puede hacer ni con la caja abierta.
        cierres = [cierre(AYER)];
        abrir(cobro({ method: 'CUENTA_CORRIENTE' }));

        expect(screen.getByText(/no entró plata a ninguna caja/i)).toBeInTheDocument();
        expect(screen.queryByText(/ya está cerrada y rendida/i)).not.toBeInTheDocument();
    });
});
