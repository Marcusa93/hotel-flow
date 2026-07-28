import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckInOccupancy } from '@/components/bookings/CheckInOccupancy';
import { getOccupancyPricing } from '@/lib/occupancyPricing';
import type { RoomType } from '@/types/hotel';

// Lo que recepción toca al recibir al huésped. La regla del precio está cubierta
// en occupancyPricing.test.ts; acá se verifica que el bloque muestre eso y que
// los botones devuelvan la ocupación corregida.

const tramo = (maxGuests: number, basePrice: number): RoomType => ({
    id: `rt-${maxGuests}`,
    name: `Hab. ${maxGuests} personas`,
    basePrice,
    maxGuests,
});

const TARIFAS = [tramo(2, 50_000), tramo(4, 90_000), tramo(5, 110_000)];
const QUINTUPLE = TARIFAS[2];

const renderBloque = (
    value = { adults: 4, children: 0, infants: 0 },
    onChange = vi.fn(),
    totals = { currentTotal: 220_000, newTotal: 180_000 }
) => {
    render(
        <CheckInOccupancy
            value={value}
            onChange={onChange}
            pricing={getOccupancyPricing(TARIFAS, QUINTUPLE, value)}
            maxGuests={QUINTUPLE.maxGuests}
            nights={2}
            currentTotal={totals.currentTotal}
            newTotal={totals.newTotal}
        />
    );
    return onChange;
};

describe('CheckInOccupancy', () => {
    it('muestra el tramo que se cobra, no la capacidad de la habitación', () => {
        // Cuatro en una quíntuple: el bloque tiene que decir "4 personas".
        renderBloque();

        expect(screen.getByText(/Tarifa 4 personas/)).toBeInTheDocument();
    });

    it('canta la diferencia contra lo que estaba pactado', () => {
        renderBloque();

        expect(screen.getByText('$180.000')).toBeInTheDocument();
        expect(screen.getByText(/Antes: \$220\.000/)).toBeInTheDocument();
        expect(screen.getByText(/−\$40\.000/)).toBeInTheDocument();
    });

    it('sin cambios no habla de precios viejos', () => {
        renderBloque({ adults: 5, children: 0, infants: 0 }, vi.fn(), {
            currentTotal: 220_000,
            newTotal: 220_000,
        });

        expect(screen.queryByText(/Antes:/)).not.toBeInTheDocument();
    });

    it('devuelve la ocupación corregida al restar una persona', () => {
        const onChange = renderBloque();

        fireEvent.click(screen.getByLabelText('Quitar Adultos'));

        expect(onChange).toHaveBeenCalledWith({ adults: 3, children: 0, infants: 0 });
    });

    it('aclara que los menores de 5 no se cobran', () => {
        renderBloque({ adults: 2, children: 0, infants: 2 });

        expect(screen.getByText(/2 menores de 5 años sin cargo/)).toBeInTheDocument();
    });

    it('avisa cuando entran más personas de las que caben', () => {
        // Los menores de 5 no se cobran pero ocupan lugar: 4 + 2 en una quíntuple.
        renderBloque({ adults: 4, children: 0, infants: 2 });

        expect(screen.getByText(/6 personas en una habitación para 5/)).toBeInTheDocument();
    });

    it('no deja bajar de un adulto', () => {
        renderBloque({ adults: 1, children: 0, infants: 0 });

        expect(screen.getByLabelText('Quitar Adultos')).toBeDisabled();
    });
});
