import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditPaymentDateDialog } from '@/components/payments/EditPaymentDateDialog';
import { formatLocalDate } from '@/lib/utils';
import type { CashClosing, Payment } from '@/types/hotel';

// Lo que recepción ve al corregirle el día a un cobro. Las reglas están cubiertas
// en paymentDate.test.ts; acá se verifica que el diálogo las respete: que muestre
// cómo queda antes de guardar, que pida confirmar, que no deje tocar una caja
// cerrada, y que lo que mande a la base sea SOLO la fecha.

const mutateAsync = vi.fn();
const refetch = vi.fn();
let cierres: CashClosing[] = [];

vi.mock('@/hooks/useCashClosings', () => ({
    useCashClosings: () => ({ data: cierres, isLoading: false, refetch }),
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
    method: 'CASH',
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

const abrir = (payment = cobro()) =>
    render(<EditPaymentDateDialog open onOpenChange={vi.fn()} payment={payment} />);

/** El casillero de día. */
const campoDia = () => screen.getByLabelText(/de qué día es este cobro/i) as HTMLInputElement;

const elegirDia = (d: Date) => fireEvent.change(campoDia(), { target: { value: formatLocalDate(d) } });

const boton = (re: RegExp) => screen.getByRole('button', { name: re });

beforeEach(() => {
    cierres = [];
    mutateAsync.mockReset().mockResolvedValue({ auditOk: true });
    refetch.mockReset().mockImplementation(() => Promise.resolve({ data: cierres }));
});

describe('el diálogo de corregir fecha', () => {
    it('abre con el día que el cobro tiene hoy', () => {
        abrir();
        expect(campoDia().value).toBe(formatLocalDate(AYER));
    });

    it('sin elegir otro día no deja guardar', () => {
        abrir();
        expect(boton(/elegí otro día/i)).toBeDisabled();
    });

    it('muestra cómo queda antes de guardar, con la hora conservada', () => {
        abrir();
        elegirDia(ANTEAYER);

        expect(screen.getByText(/la hora se conserva/i)).toBeInTheDocument();
        // 09:30 a los dos lados: el día cambia, la hora no.
        expect(screen.getAllByText(/09:30/).length).toBeGreaterThanOrEqual(2);
    });

    it('pide confirmar antes de mover la plata', async () => {
        abrir();
        elegirDia(ANTEAYER);

        fireEvent.click(boton(/^mover al/i));

        expect(mutateAsync).not.toHaveBeenCalled();
        expect(await screen.findByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    });

    it('manda SOLO la fecha, con el día elegido y la hora original', async () => {
        abrir();
        elegirDia(ANTEAYER);

        fireEvent.click(boton(/^mover al/i));
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

        const args = mutateAsync.mock.calls[0][0];
        // Ni el estado ni el monto viajan: son otros daños contables.
        expect(Object.keys(args.data)).toEqual(['date']);
        expect(formatLocalDate(args.data.date)).toBe(formatLocalDate(ANTEAYER));
        expect(args.data.date.getHours()).toBe(9);
        expect(args.data.date.getMinutes()).toBe(30);
        // La guarda contra pisar la corrección de otro.
        expect(args.expectedDate.getTime()).toBe(AYER.getTime());
    });

    it('deja el rastro con los dos días y el monto', async () => {
        abrir();
        elegirDia(ANTEAYER);
        fireEvent.click(boton(/^mover al/i));
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());

        const { audit } = mutateAsync.mock.calls[0][0];
        expect(audit.description).toMatch(/Cobro reimputado del .* al .* — \$85\.000 \(Efectivo\)/);
        // Como texto y no como Date: la pantalla de auditoría imprime el valor crudo.
        expect(typeof audit.oldValues.fecha).toBe('string');
        expect(audit.metadata.diaDestino).toBe(formatLocalDate(ANTEAYER));
    });

    it('cambiar de día otra vez vuelve a pedir confirmación', async () => {
        abrir();
        elegirDia(ANTEAYER);
        fireEvent.click(boton(/^mover al/i));
        await screen.findByRole('button', { name: /confirmar/i });

        elegirDia(diaAtras(3));

        expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
    });
});

describe('cuando el día elegido no sirve', () => {
    it('dice por qué, en vez de dejar el botón muerto sin explicación', () => {
        abrir();
        elegirDia(diaAtras(400)); // el año mal tecleado

        expect(screen.getByText(/más de 60 días atrás/i)).toBeInTheDocument();
        expect(boton(/revisá el día/i)).toBeDisabled();
    });

    it('con el campo vacío no inventa un movimiento', () => {
        abrir();
        fireEvent.change(campoDia(), { target: { value: '' } });

        // Antes mostraba "Esto cambia el resultado de dos meses" y un botón que
        // decía "Mover al ", porque el veredicto se calculaba sobre el día crudo.
        expect(screen.queryByText(/cambia el resultado de dos meses/i)).not.toBeInTheDocument();
        expect(boton(/revisá el día/i)).toBeDisabled();
    });
});

describe('cuando la caja ya está cerrada', () => {
    it('no deja sacarle un cobro al día que ya se rindió', () => {
        cierres = [cierre(AYER)];
        abrir();
        elegirDia(ANTEAYER);

        expect(screen.getByText(/ya está cerrada y rendida/i)).toBeInTheDocument();
        expect(boton(/^mover al/i)).toBeDisabled();
    });

    it('tampoco deja meterle un cobro', () => {
        cierres = [cierre(ANTEAYER)];
        abrir();
        elegirDia(ANTEAYER);

        expect(screen.getByText(/ya está cerrada y rendida/i)).toBeInTheDocument();
        expect(boton(/^mover al/i)).toBeDisabled();
    });

    it('desaconseja el reembolso, que es el atajo que rompe todo', () => {
        cierres = [cierre(AYER)];
        abrir();
        elegirDia(ANTEAYER);

        expect(screen.getByText(/no marques el cobro como reembolsado/i)).toBeInTheDocument();
    });

    it('un día reabierto vuelve a dejarse tocar', () => {
        cierres = [cierre(AYER, { reopenedAt: new Date() })];
        abrir();
        elegirDia(ANTEAYER);

        expect(screen.queryByText(/ya está cerrada y rendida/i)).not.toBeInTheDocument();
        expect(boton(/^mover al/i)).toBeEnabled();
    });

    it('si la cierran entre el confirmar y el guardar, aborta', async () => {
        abrir();
        elegirDia(ANTEAYER);
        fireEvent.click(boton(/^mover al/i));

        // El otro turno cierra la caja justo ahí. El refetch previo lo tiene que ver.
        refetch.mockResolvedValue({ data: [cierre(ANTEAYER)] });
        fireEvent.click(boton(/confirmar/i));

        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});

describe('el cargo a cuenta corriente', () => {
    it('no promete que la plata cambia de caja, porque no entra a ninguna', () => {
        abrir(cobro({ method: 'CUENTA_CORRIENTE' }));
        elegirDia(ANTEAYER);

        expect(screen.getByText(/no entra a ninguna caja/i)).toBeInTheDocument();
    });
});
