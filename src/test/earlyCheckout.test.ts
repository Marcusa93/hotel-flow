import { describe, it, expect } from 'vitest';
import { buildEarlyCheckout, describeEarlyCheckout } from '@/lib/earlyCheckout';

// El huésped reservó cuatro noches y se va en la segunda. Se cobran las que
// estuvo y nada más: sin multa, y sin rearmar el precio desde la tarifa de hoy.

const base = {
  checkInDate: new Date(2026, 7, 1),
  bookedCheckOut: new Date(2026, 7, 4), // 3 noches
  agreedTotal: 150_000,
};

describe('buildEarlyCheckout', () => {
  it('cobra solo las noches que estuvo', () => {
    // El caso que pidió el hotel: figuraban 3 noches, ocupó 2, se cobran 2.
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 3) });

    expect(result.bookedNights).toBe(3);
    expect(result.stayedNights).toBe(2);
    expect(result.lodgingTotal).toBe(100_000);
    expect(result.credited).toBe(50_000);
  });

  it('libera las noches que no se usaron', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 2) });

    expect(result.stayedNights).toBe(1);
    expect(result.releasedNights).toBe(2);
  });

  it('no cobra multa: el precio por noche es el mismo que se pactó', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 3) });

    expect(result.nightlyRate).toBe(50_000);
    expect(result.lodgingTotal).toBe(result.nightlyRate * result.stayedNights);
  });

  it('conserva la promoción sin tener que resolverla', () => {
    // Reservó con 10% off: 3 noches a $48.000 en vez de $53.333. Al prorratear lo
    // pactado el descuento viaja solo. Rearmarlo desde la lista le subiría el
    // precio al huésped justo cuando se está yendo.
    const result = buildEarlyCheckout({
      ...base,
      agreedTotal: 144_000,
      actualCheckOut: new Date(2026, 7, 3),
    });

    expect(result.lodgingTotal).toBe(96_000);
  });

  it('irse el mismo día que entró cobra una noche igual', () => {
    // Esa noche la habitación ya salió de la venta: nadie más la va a usar.
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 1) });

    expect(result.stayedNights).toBe(1);
    expect(result.lodgingTotal).toBe(50_000);
    // Y la fecha acompaña: guardar la salida el mismo día que la entrada dejaría
    // la reserva en cero noches cobrando una, que además es la forma exacta de
    // una media estadía.
    expect(result.actualCheckOut).toEqual(new Date(2026, 7, 2));
  });

  it('la salida guardada siempre coincide con las noches cobradas', () => {
    for (const dia of [1, 2, 3, 4]) {
      const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, dia) });
      const nochesSegunFecha = Math.round(
        (result.actualCheckOut.getTime() - base.checkInDate.getTime()) / 86_400_000
      );
      expect(nochesSegunFecha).toBe(result.stayedNights);
    }
  });

  it('la hora del mostrador no se cuela en la fecha guardada', () => {
    // El día real sale de `new Date()`, que trae la hora puesta.
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 3, 17, 42) });

    expect(result.actualCheckOut).toEqual(new Date(2026, 7, 3));
    expect(result.stayedNights).toBe(2);
  });

  it('no deja estirar la estadía por acá', () => {
    // Quedarse de más es Extender estadía, que cobra las noches nuevas como cargo
    // aparte en vez de prorratear lo pactado.
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 9) });

    expect(result.stayedNights).toBe(3);
    expect(result.credited).toBe(0);
    expect(result.lodgingTotal).toBe(150_000);
  });

  it('salir el día que estaba previsto no cambia nada', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 4) });

    expect(result.stayedNights).toBe(3);
    expect(result.releasedNights).toBe(0);
    expect(result.credited).toBe(0);
    expect(result.lodgingTotal).toBe(base.agreedTotal);
  });

  it('la media estadía no tiene noches que devolver', () => {
    // Entra y sale el mismo día: es lo que la define, y dividir por sus cero
    // noches daría infinito.
    const result = buildEarlyCheckout({
      checkInDate: new Date(2026, 7, 1),
      bookedCheckOut: new Date(2026, 7, 1),
      actualCheckOut: new Date(2026, 7, 1),
      agreedTotal: 25_000,
    });

    expect(result.lodgingTotal).toBe(25_000);
    expect(result.credited).toBe(0);
    expect(Number.isFinite(result.nightlyRate)).toBe(true);
  });

  it('redondea a peso entero', () => {
    // 100.000 / 3 no da redondo, y un total con decimales entra en la base como
    // un monto raro y no cierra contra lo que se cobró.
    const result = buildEarlyCheckout({
      ...base,
      agreedTotal: 100_000,
      actualCheckOut: new Date(2026, 7, 3),
    });

    expect(Number.isInteger(result.lodgingTotal)).toBe(true);
    expect(result.lodgingTotal).toBe(66_667);
  });
});

// Cuando la estadía se extendió, la plata del alojamiento vive en dos lugares:
// total_amount tiene lo que se cotizó al reservar, y las noches agregadas después
// van como cargo aparte. La fecha de salida, en cambio, se movió por las dos.

const extension = (over: Partial<{ id: string; amount: number; quantity: number; createdAt: Date }> = {}) => ({
  id: 'ext-1',
  amount: 80_000,
  quantity: 2,
  createdAt: new Date(2026, 7, 2),
  ...over,
});

describe('buildEarlyCheckout con estadía extendida', () => {
  // El caso que reportó el hotel: reservó 1 noche a $80.000, la extendió 2 noches
  // más ($160.000 de cargo), y se fue en la segunda.
  const extendida = {
    checkInDate: new Date(2026, 7, 1),
    bookedCheckOut: new Date(2026, 7, 4), // 3 noches después de extender
    agreedTotal: 80_000, // pero el total solo cubre la primera
    lodgingCharges: [extension()],
  };

  it('no inventa un precio por noche repartiendo el total sobre todas', () => {
    // El bug: $80.000 / 3 noches = $26.667 la noche, un precio que nunca existió.
    const result = buildEarlyCheckout({ ...extendida, actualCheckOut: new Date(2026, 7, 3) });

    expect(result.bookedBaseNights).toBe(1);
    expect(result.nightlyRate).toBe(80_000);
  });

  it('cobra las noches usadas de cada balde, a su precio', () => {
    // Se quedó 2: la original ($80.000) y la primera de la extensión ($80.000).
    const result = buildEarlyCheckout({ ...extendida, actualCheckOut: new Date(2026, 7, 3) });

    expect(result.stayedNights).toBe(2);
    expect(result.lodgingTotal).toBe(80_000);
    expect(result.chargeAdjustments).toEqual([
      { id: 'ext-1', quantity: 1, credited: 80_000 },
    ]);
    // $80.000 de reserva + $80.000 de la noche extendida que sí usó = $160.000.
    expect(result.lodgingTotal + extension().amount * result.chargeAdjustments[0].quantity)
      .toBe(160_000);
  });

  it('devuelve todas las noches agregadas si no usó ninguna', () => {
    const result = buildEarlyCheckout({ ...extendida, actualCheckOut: new Date(2026, 7, 2) });

    expect(result.stayedNights).toBe(1);
    expect(result.lodgingTotal).toBe(80_000);
    expect(result.chargeAdjustments[0]).toEqual({ id: 'ext-1', quantity: 0, credited: 160_000 });
    expect(result.credited).toBe(160_000);
  });

  it('no toca el cargo si se queda hasta el final', () => {
    const result = buildEarlyCheckout({ ...extendida, actualCheckOut: new Date(2026, 7, 4) });

    expect(result.credited).toBe(0);
    expect(result.chargeAdjustments[0].quantity).toBe(2);
  });

  it('va gastando las extensiones en el orden en que se agregaron', () => {
    // Extendió el 2 y después el 3: esas son, en ese orden, las noches 2 y 3.
    const result = buildEarlyCheckout({
      checkInDate: new Date(2026, 7, 1),
      bookedCheckOut: new Date(2026, 7, 4),
      agreedTotal: 80_000,
      lodgingCharges: [
        extension({ id: 'segunda', quantity: 1, createdAt: new Date(2026, 7, 3) }),
        extension({ id: 'primera', quantity: 1, createdAt: new Date(2026, 7, 2) }),
      ],
      actualCheckOut: new Date(2026, 7, 3),
    });

    const porId = Object.fromEntries(result.chargeAdjustments.map(a => [a.id, a.quantity]));
    expect(porId).toEqual({ primera: 1, segunda: 0 });
  });

  it('el crédito total suma la reserva y los cargos', () => {
    const result = buildEarlyCheckout({
      checkInDate: new Date(2026, 7, 1),
      bookedCheckOut: new Date(2026, 7, 5), // 2 originales + 2 extendidas
      agreedTotal: 160_000,
      lodgingCharges: [extension({ quantity: 2 })],
      actualCheckOut: new Date(2026, 7, 2), // se queda 1 noche
    });

    // Devuelve 1 noche original ($80.000) y las 2 extendidas ($160.000).
    expect(result.lodgingTotal).toBe(80_000);
    expect(result.credited).toBe(240_000);
  });

  it('con datos incoherentes no inventa devoluciones', () => {
    // Los cargos dicen cubrir más noches de las que tiene la estadía entera.
    const result = buildEarlyCheckout({
      checkInDate: new Date(2026, 7, 1),
      bookedCheckOut: new Date(2026, 7, 3),
      agreedTotal: 80_000,
      lodgingCharges: [extension({ quantity: 5 })],
      actualCheckOut: new Date(2026, 7, 2),
    });

    expect(result.chargeAdjustments).toEqual([]);
    expect(Number.isFinite(result.nightlyRate)).toBe(true);
  });

  it('una reserva sin extensiones se comporta igual que antes', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 3) });

    expect(result.bookedBaseNights).toBe(3);
    expect(result.chargeAdjustments).toEqual([]);
    expect(result.lodgingTotal).toBe(100_000);
  });
});

describe('describeEarlyCheckout', () => {
  it('dice qué se cobró y qué se dejó de cobrar', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 3) });

    expect(describeEarlyCheckout(result)).toBe(
      'Salida adelantada al 3 ago: se cobran 2 noches de las 3 noches reservadas (salía el 4 ago)'
    );
  });

  it('una sola noche va en singular', () => {
    const result = buildEarlyCheckout({ ...base, actualCheckOut: new Date(2026, 7, 2) });

    expect(describeEarlyCheckout(result)).toContain('se cobran 1 noche de las 3 noches');
  });
});
