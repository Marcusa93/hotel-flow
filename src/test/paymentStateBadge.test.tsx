import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentStateBadge } from '@/components/shared/PaymentStateBadge';
import { buildBookingAccount } from '@/lib/bookingAccount';

// Lo que el recepcionista lee en el tablero de Reservas. La lógica del estado
// está cubierta en bookingAccount.test.ts; acá se verifica que el badge muestre
// eso y no otra cosa.

const habitacionPagaConExtras = () =>
    buildBookingAccount({
        booking: { totalAmount: 240_000 },
        payments: [{ amount: 240_000, status: 'PAID' }],
        charges: [{ amount: 80_000, quantity: 2 }],
    });

describe('PaymentStateBadge', () => {
    it('avisa que quedan extras aunque la habitación esté paga', () => {
        render(<PaymentStateBadge account={habitacionPagaConExtras()} />);

        expect(screen.getByText('Extras $160.000')).toBeInTheDocument();
        expect(screen.queryByText('Pagado')).not.toBeInTheDocument();
    });

    it('dice Pagado solo cuando no queda nada por cobrar', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 240_000 },
            payments: [{ amount: 400_000, status: 'PAID' }],
            charges: [{ amount: 80_000, quantity: 2 }],
        });

        render(<PaymentStateBadge account={account} />);

        expect(screen.getByText('Pagado')).toBeInTheDocument();
    });

    it('deja el texto accesible cuando solo se muestra el ícono', () => {
        // En la tabla la celda es angosta y va sin texto visible. El lector de
        // pantalla y el tooltip tienen que seguir diciendo qué pasa.
        render(<PaymentStateBadge account={habitacionPagaConExtras()} iconOnly />);

        expect(screen.getByText('Extras $160.000')).toBeInTheDocument();
        expect(screen.getByTitle('Extras $160.000')).toBeInTheDocument();
    });
});
