import { describe, it, expect } from 'vitest';
import {
    getOccupancyPricing,
    billableGuests,
    totalOccupants,
    bookingDiscountRatio,
} from '@/lib/occupancyPricing';
import type { RoomType } from '@/types/hotel';

// Los tipos de este hotel son tramos de capacidad: "Hab. N personas" con su precio.
const tramo = (maxGuests: number, basePrice: number): RoomType => ({
    id: `rt-${maxGuests}`,
    name: `Hab. ${maxGuests} personas`,
    basePrice,
    maxGuests,
});

const DOBLE = tramo(2, 50_000);
const TRIPLE = tramo(3, 70_000);
const CUADRUPLE = tramo(4, 90_000);
const QUINTUPLE = tramo(5, 110_000);
const TARIFAS = [DOBLE, TRIPLE, CUADRUPLE, QUINTUPLE];

describe('billableGuests', () => {
    it('no cobra a los menores de 5', () => {
        // El reporte del hotel: adults + children definen el precio, infants no.
        expect(billableGuests({ adults: 2, children: 2 })).toBe(4);
        expect(totalOccupants({ adults: 2, children: 2, infants: 1 })).toBe(5);
    });

    it('suma los inputs numéricos como números y no como texto', () => {
        // <Input type="number"> devuelve string: '2' + '2' daría '22'.
        expect(billableGuests({ adults: '2', children: '2' })).toBe(4);
    });
});

describe('getOccupancyPricing', () => {
    it('cobra el tramo de cuatro cuando entran cuatro a una quíntuple', () => {
        // El caso exacto que reportó el hotel.
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 4, children: 0 });

        expect(pricing?.nightlyPrice).toBe(90_000);
        expect(pricing?.pricingType.maxGuests).toBe(4);
        expect(pricing?.isDownTiered).toBe(true);
    });

    it('cobra el tramo de dos cuando entran dos a una triple', () => {
        const pricing = getOccupancyPricing(TARIFAS, TRIPLE, { adults: 2, children: 0 });

        expect(pricing?.nightlyPrice).toBe(50_000);
        expect(pricing?.isDownTiered).toBe(true);
    });

    it('la habitación llena se cobra a su propio precio', () => {
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 5, children: 0 });

        expect(pricing?.nightlyPrice).toBe(110_000);
        expect(pricing?.isDownTiered).toBe(false);
    });

    it('los menores de 5 no bajan el tramo por sí solos', () => {
        // 2 grandes + 2 chicos de 5+ son 4 que se cobran, aunque haya un bebé más.
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 2, children: 2 });

        expect(pricing?.billable).toBe(4);
        expect(pricing?.nightlyPrice).toBe(90_000);
    });

    it('nunca cobra más caro que la habitación, ni con la capacidad excedida', () => {
        // Recepción puede forzar seis en una quíntuple; eso no la hace séxtuple.
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 6, children: 0 });

        expect(pricing?.nightlyPrice).toBe(110_000);
        expect(pricing?.isDownTiered).toBe(false);
    });

    it('sin tramo exacto redondea al inmediato superior', () => {
        // Sin cuádruple cargada, cuatro personas pagan la quíntuple: es lo más
        // barato que los aloja, no se inventa un precio intermedio.
        const pricing = getOccupancyPricing([DOBLE, TRIPLE, QUINTUPLE], QUINTUPLE, {
            adults: 4,
            children: 0,
        });

        expect(pricing?.nightlyPrice).toBe(110_000);
    });

    it('un tramo menor mal cargado —más caro— no se cobra', () => {
        const cuadrupleCara = tramo(4, 200_000);
        const pricing = getOccupancyPricing([DOBLE, cuadrupleCara, QUINTUPLE], QUINTUPLE, {
            adults: 4,
            children: 0,
        });

        expect(pricing?.nightlyPrice).toBe(110_000);
    });

    it('con la habitación sin elegir todavía no decide nada', () => {
        expect(getOccupancyPricing(TARIFAS, null, { adults: 2, children: 0 })).toBeNull();
    });

    it('sin gente cargada vale el precio de la habitación', () => {
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 0, children: 0 });

        expect(pricing?.nightlyPrice).toBe(110_000);
    });
});

describe('bookingDiscountRatio', () => {
    it('rescata la proporción descontada para no perderla al recalcular', () => {
        expect(bookingDiscountRatio({ baseAmount: 100_000, discountAmount: 20_000 })).toBe(0.2);
    });

    it('sin promoción no descuenta nada', () => {
        expect(bookingDiscountRatio({})).toBe(0);
        expect(bookingDiscountRatio({ baseAmount: 100_000, discountAmount: 0 })).toBe(0);
        // Reservas anteriores al seguimiento de promos: no tienen baseAmount.
        expect(bookingDiscountRatio({ discountAmount: 20_000 })).toBe(0);
    });
});
