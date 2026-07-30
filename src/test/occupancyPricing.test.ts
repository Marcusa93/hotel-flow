import { describe, it, expect } from 'vitest';
import {
    getOccupancyPricing,
    getBookingPricing,
    selectableTiers,
    describeDownTier,
    billableGuests,
    totalOccupants,
    bookingDiscountRatio,
    resolveCheckInTotal,
    resolveEditedTotal,
    halfDayTotal,
    stayTotal,
} from '@/lib/occupancyPricing';
import type { Rate, RoomType } from '@/types/hotel';

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

describe('tramo simple', () => {
    const SIMPLE = tramo(1, 30_000);

    it('el que viene solo paga la simple, esté en la habitación que esté', () => {
        // La doble cobrada como simple, que es como la cobra el hotel.
        const enDoble = getOccupancyPricing([SIMPLE, ...TARIFAS], DOBLE, { adults: 1, children: 0 });
        const enQuintuple = getOccupancyPricing([SIMPLE, ...TARIFAS], QUINTUPLE, { adults: 1, children: 0 });

        expect(enDoble?.nightlyPrice).toBe(30_000);
        expect(enQuintuple?.nightlyPrice).toBe(30_000);
    });

    it('sin tramo simple cargado cae en el piso de la lista', () => {
        // Lo que llegó reportado como precio duplicado: entra uno y se cobra la
        // tarifa de dos. No se duplica nada, es que abajo de dos no hay nada.
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 1, children: 0 });

        expect(pricing?.nightlyPrice).toBe(50_000);
        expect(pricing?.pricingType.maxGuests).toBe(2);
    });

    it('mientras valga lo mismo que la doble no cambia ningún precio', () => {
        // Así entra la migración: la simple se crea copiando el precio del tramo
        // más chico, para no mover un peso hasta que el hotel le ponga el suyo.
        const simpleAlPrecioDeLaDoble = tramo(1, DOBLE.basePrice);
        const pricing = getOccupancyPricing(
            [simpleAlPrecioDeLaDoble, ...TARIFAS],
            DOBLE,
            { adults: 1, children: 0 }
        );

        expect(pricing?.nightlyPrice).toBe(DOBLE.basePrice);
    });
});

describe('getBookingPricing', () => {
    it('sin tarifa elegida decide la ocupación, como siempre', () => {
        const pricing = getBookingPricing(TARIFAS, QUINTUPLE, { adults: 4, children: 0 }, null);

        expect(pricing?.nightlyPrice).toBe(90_000);
        expect(pricing?.isManual).toBeUndefined();
    });

    it('con tarifa elegida se cobra esa y no la que sale del cálculo', () => {
        // Lo que pidió el hotel: viene uno solo y se le cobra igual la doble.
        const pricing = getBookingPricing(TARIFAS, DOBLE, { adults: 1, children: 0 }, DOBLE.id);

        expect(pricing?.nightlyPrice).toBe(50_000);
        expect(pricing?.pricingType.maxGuests).toBe(2);
        expect(pricing?.isManual).toBe(true);
    });

    it('la elección no se mueve aunque cambie la gente', () => {
        // Es la razón de ser de la columna: el check-in no puede recalcularla.
        const conUno = getBookingPricing(TARIFAS, QUINTUPLE, { adults: 1, children: 0 }, TRIPLE.id);
        const conCuatro = getBookingPricing(TARIFAS, QUINTUPLE, { adults: 4, children: 0 }, TRIPLE.id);

        expect(conUno?.nightlyPrice).toBe(70_000);
        expect(conCuatro?.nightlyPrice).toBe(70_000);
    });

    it('un tramo elegido que ya no existe vuelve al automático', () => {
        // Borrado de Tarifas: antes que dejar la reserva sin precio, se calcula.
        const pricing = getBookingPricing(TARIFAS, QUINTUPLE, { adults: 4, children: 0 }, 'rt-borrado');

        expect(pricing?.nightlyPrice).toBe(90_000);
        expect(pricing?.isManual).toBeUndefined();
    });
});

describe('selectableTiers', () => {
    it('no ofrece tramos más grandes que la habitación', () => {
        // Elegir la quíntuple para una triple sería cobrar más que la habitación.
        expect(selectableTiers(TARIFAS, TRIPLE).map(rt => rt.maxGuests)).toEqual([2, 3]);
    });

    it('los ordena de menor a mayor sin importar cómo vengan', () => {
        const desordenadas = [QUINTUPLE, DOBLE, CUADRUPLE, TRIPLE];

        expect(selectableTiers(desordenadas, QUINTUPLE).map(rt => rt.maxGuests)).toEqual([2, 3, 4, 5]);
        // No los reordena en la lista original, que es la que muestra Tarifas.
        expect(desordenadas[0].maxGuests).toBe(5);
    });

    it('sin habitación elegida no ofrece nada', () => {
        expect(selectableTiers(TARIFAS, null)).toEqual([]);
    });
});

describe('describeDownTier', () => {
    it('cuando el tramo coincide con la gente lo dice derecho', () => {
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 4, children: 0 })!;

        expect(describeDownTier(pricing, 5)).toBe(
            'Entran 4 en una habitación de 5: se cobra la tarifa de 4 personas.'
        );
    });

    it('cuando no hay tarifa para esa cantidad aclara que se cobra la más cercana', () => {
        // La frase vieja —"entran 1: se cobra la tarifa de 2 personas"— se leía
        // como un recargo y volvió del hotel marcada como error de precio.
        const pricing = getOccupancyPricing(TARIFAS, QUINTUPLE, { adults: 1, children: 0 })!;

        expect(describeDownTier(pricing, 5)).toBe(
            'Entra 1 en una habitación de 5: no hay tarifa de 1, se cobra la más cercana, la de 2 personas.'
        );
    });

    it('con la simple cargada el singular queda bien', () => {
        const SIMPLE = tramo(1, 30_000);
        const pricing = getOccupancyPricing([SIMPLE, ...TARIFAS], DOBLE, { adults: 1, children: 0 })!;

        expect(describeDownTier(pricing, 2)).toBe(
            'Entra 1 en una habitación de 2: se cobra la tarifa de 1 persona.'
        );
    });
});

describe('resolveCheckInTotal', () => {
    // Reserva sana: quíntuple, 3 noches, 5 personas → 3 × 110.000 = 330.000.
    const sana = { agreedTotal: 330_000, nights: 3, bookedTierNightly: 110_000 };

    it('descuenta la diferencia de tramo cuando llegan menos personas', () => {
        // Reservaron 5, entran 4: pasa de quíntuple a cuádruple.
        expect(resolveCheckInTotal({ ...sana, tierNightly: 90_000 })).toBe(270_000);
    });

    it('sin cambio de tramo no toca el total', () => {
        expect(resolveCheckInTotal({ ...sana, tierNightly: 110_000 })).toBe(330_000);
    });

    it('respeta lo pactado cuando la tarifa subió después de reservar', () => {
        // Se pactó 300.000 y hoy la lista da 330.000. Bajar de 5 a 4 tiene que
        // descontar sobre lo pactado, no re-cotizar a la tarifa nueva.
        expect(
            resolveCheckInTotal({ ...sana, agreedTotal: 300_000, tierNightly: 90_000 })
        ).toBe(240_000);
    });

    it('nunca cobra más que la lista de hoy por lo que se está ocupando', () => {
        // Reserva vieja: 4 personas en una quíntuple cargada al precio de la
        // habitación (330.000). Corregida a 5, el delta daba 390.000 — más caro
        // que la quíntuple entera. El techo lo corta en la lista.
        const vieja = { agreedTotal: 330_000, nights: 3, bookedTierNightly: 90_000 };

        expect(resolveCheckInTotal({ ...vieja, tierNightly: 110_000 })).toBe(330_000);
    });

    it('reaplica la promoción de precio plano en vez de escalarla', () => {
        // Promo de $80.000 la noche. Escalando por proporción se regalaban
        // $43.636; el precio plano no es proporcional al precio base.
        const promoPlana: Partial<Rate> = { price: 80_000 };

        expect(
            resolveCheckInTotal({
                ...sana,
                agreedTotal: 240_000,
                tierNightly: 90_000,
                promo: promoPlana as Rate,
                discountRatio: 0.2727,
            })
        ).toBe(240_000);
    });

    it('reaplica la promoción de monto fijo sobre el tramo nuevo', () => {
        // $10.000 off por noche sobre la cuádruple de 90.000 → 80.000 x 3.
        const promoFija: Partial<Rate> = { price: 0, discountType: 'FIXED', discountAmount: 10_000 };

        expect(
            resolveCheckInTotal({
                ...sana,
                agreedTotal: 300_000,
                tierNightly: 90_000,
                promo: promoFija as Rate,
            })
        ).toBe(240_000);
    });

    it('con la promoción borrada cae en la proporción guardada', () => {
        // 10% off: la cuádruple de 90.000 queda en 81.000 la noche.
        expect(
            resolveCheckInTotal({
                ...sana,
                agreedTotal: 297_000,
                tierNightly: 90_000,
                discountRatio: 0.1,
            })
        ).toBe(243_000);
    });

    it('sin noches no inventa un total', () => {
        expect(
            resolveCheckInTotal({ agreedTotal: 330_000, nights: 0, tierNightly: 90_000, bookedTierNightly: 110_000 })
        ).toBe(330_000);
    });
});

describe('resolveEditedTotal', () => {
    // El caso que llegó de producción: reserva de 2 noches en una doble de
    // $80.000, tomada con PROMO26 (10% off) → $144.000 pactados y pagados.
    const conPromo = {
        agreedTotal: 144_000,
        agreedNights: 2,
        nights: 2,
        tierNightly: 80_000,
        bookedTierNightly: 80_000,
        discountRatio: 0.1,
    };

    it('abrir la edición sin tocar nada no mueve el total', () => {
        // Editar recalculaba noches x tramo y proponía $160.000: le devolvía el
        // precio de lista a alguien que había reservado con descuento, y como
        // esa reserva ya estaba paga le inventaba una deuda de $16.000.
        expect(resolveEditedTotal(conPromo)).toBe(144_000);
    });

    it('cambiar de habitación conserva el descuento sobre el tramo nuevo', () => {
        // Se lo pasa a una triple de $70.000. El 10% se sigue aplicando.
        expect(
            resolveEditedTotal({ ...conPromo, tierNightly: 70_000 })
        ).toBe(126_000);
    });

    it('con la promoción todavía viva la reaplica en vez de escalarla', () => {
        // Una promo de precio plano no es proporcional al precio base: escalarla
        // por la proporción guardada regala o cobra de más.
        const promoPlana: Partial<Rate> = { price: 60_000 };

        expect(
            resolveEditedTotal({ ...conPromo, tierNightly: 70_000, promo: promoPlana as Rate })
        ).toBe(120_000);
    });

    it('agregar una noche cobra el precio pactado, no el de lista', () => {
        // Lo pactado son $72.000 la noche (80.000 con 10% off). Tres noches son
        // 216.000 y no 240.000.
        expect(
            resolveEditedTotal({ ...conPromo, nights: 3 })
        ).toBe(216_000);
    });

    it('la tarifa especial no la mueve el cambio de habitación', () => {
        // Es un precio por noche acordado con ese cliente: son $X entre en la
        // doble o en la quíntuple.
        expect(
            resolveEditedTotal({
                agreedTotal: 100_000,
                agreedNights: 2,
                nights: 2,
                tierNightly: 110_000,
                bookedTierNightly: 50_000,
                specialRateNightly: 50_000,
            })
        ).toBe(100_000);
    });

    it('la tarifa especial sí sigue a las noches', () => {
        expect(
            resolveEditedTotal({
                agreedTotal: 100_000,
                agreedNights: 2,
                nights: 3,
                tierNightly: 110_000,
                bookedTierNightly: 50_000,
                specialRateNightly: 50_000,
            })
        ).toBe(150_000);
    });

    it('una reserva sin promoción se corre por la diferencia de tramo', () => {
        // Quíntuple de 3 noches a 330.000, pasada a una cuádruple de 90.000.
        expect(
            resolveEditedTotal({
                agreedTotal: 330_000,
                agreedNights: 3,
                nights: 3,
                tierNightly: 90_000,
                bookedTierNightly: 110_000,
            })
        ).toBe(270_000);
    });

    it('sigue sin cobrar más que la lista de hoy', () => {
        // Reserva vieja cargada al precio de la habitación: el techo la corta.
        expect(
            resolveEditedTotal({
                agreedTotal: 330_000,
                agreedNights: 3,
                nights: 3,
                tierNightly: 110_000,
                bookedTierNightly: 90_000,
            })
        ).toBe(330_000);
    });

    it('sin noches no inventa un total', () => {
        expect(
            resolveEditedTotal({ ...conPromo, nights: 0 })
        ).toBe(0);
    });
});

describe('media estadía', () => {
    // Del hotel: 10:00 a 18:00, "un costo del 50% de lo que corresponde a cada
    // habitación". Lo que corresponde es el tramo por la gente que entra.

    it('cobra la mitad del tramo', () => {
        expect(halfDayTotal(80_000)).toBe(40_000);
    });

    it('redondea el medio peso en vez de arrastrarlo', () => {
        expect(halfDayTotal(85_000)).toBe(42_500);
        expect(halfDayTotal(85_001)).toBe(42_501);
    });

    it('stayTotal no la multiplica por noches: no tiene', () => {
        // Entra y sale el mismo día, así que nights es 0 y el total sería cero
        // si pasara por el cálculo normal.
        expect(stayTotal(80_000, 0, true)).toBe(40_000);
    });

    it('stayTotal sigue cobrando noches cuando no es media estadía', () => {
        expect(stayTotal(80_000, 2, false)).toBe(160_000);
        expect(stayTotal(80_000, 0, false)).toBe(0);
    });

    it('editar una media estadía la mantiene a mitad de tramo', () => {
        // Cambiarla de habitación la recotiza sobre el tramo nuevo, siempre al 50%.
        expect(
            resolveEditedTotal({
                agreedTotal: 40_000,
                agreedNights: 0,
                nights: 0,
                tierNightly: 70_000,
                bookedTierNightly: 80_000,
                isHalfDay: true,
            })
        ).toBe(35_000);
    });

    it('la media estadía no toma promociones ni tarifa especial', () => {
        // El 50% ya es el descuento; encimarle otro sería rebajar dos veces.
        const promoPlana: Partial<Rate> = { price: 60_000 };

        expect(
            resolveEditedTotal({
                agreedTotal: 40_000,
                agreedNights: 0,
                nights: 0,
                tierNightly: 80_000,
                bookedTierNightly: 80_000,
                isHalfDay: true,
                specialRateNightly: 50_000,
                promo: promoPlana as Rate,
                discountRatio: 0.2,
            })
        ).toBe(40_000);
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
