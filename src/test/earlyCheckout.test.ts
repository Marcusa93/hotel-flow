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
