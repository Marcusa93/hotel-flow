import { describe, it, expect } from 'vitest';
import { narrateMonth, type NarrativeInput } from '@/lib/monthNarrative';
import { summarizeMovements } from '@/lib/heladera';
import type { DayOccupancy, MonthOccupancy } from '@/lib/monthlySummary';

// El resumen escrito del PDF. Lo que se prueba acá es que ninguna frase pueda
// ser falsa: que no aparezca una comparación que no se puede hacer, que no se
// divida por cero en un mes vacío, y que la lista de "para mirar" quede callada
// cuando no hay nada raro — una lista que se llena todos los meses no se lee, y
// entonces el mes en que sí pasó algo pasa de largo.

/** Agosto 2026 arranca sábado. Sirve para armar findes de verdad. */
const dias = (ocupadasPorDia: (d: Date) => number, cuantos = 31): DayOccupancy[] =>
    Array.from({ length: cuantos }, (_, i) => {
        const date = new Date(2026, 7, i + 1);
        return { date, occupied: ocupadasPorDia(date) };
    });

const ocupacion = (over: Partial<MonthOccupancy> = {}): MonthOccupancy => {
    const byDay = over.byDay ?? dias(() => 10);
    return {
        nightsSold: byDay.reduce((s, d) => s + d.occupied, 0),
        nightsAvailable: 20 * byDay.length,
        rate: (byDay.reduce((s, d) => s + d.occupied, 0) / (20 * byDay.length)) * 100,
        daysCounted: byDay.length,
        byDay,
        busiest: null,
        quietest: null,
        halfDays: 0,
        ...over,
    };
};

const entrada = (over: Partial<NarrativeInput> = {}): NarrativeInput => ({
    income: {
        byMethod: { CASH: 400000, TRANSFER: 600000 },
        total: 1000000, fromBookings: 900000, fromOther: 100000,
        fromAccounts: 0, toAccounts: 0,
    },
    expenses: {
        byType: { SUPERMERCADO: 200000 }, byMethod: { CASH: 200000 },
        cash: 200000, cashRecaudacion: 200000, cashEmpresa: 0,
        empresa: 0, unspecified: 0, total: 200000,
    },
    occupancy: ocupacion(),
    byType: [],
    guests: { arrivals: 40, people: 88, lost: 2, avgNights: 2.5 },
    minibar: summarizeMovements([]),
    result: 800000,
    isPartial: false,
    ...over,
});

const texto = (input: NarrativeInput) => {
    const n = narrateMonth(input);
    return [...n.ocupacion, ...n.plata, ...n.atencion].join(' ');
};

describe('el párrafo de ocupación', () => {
    it('dice cuánto se vendió sobre cuánto había', () => {
        const n = narrateMonth(entrada());
        expect(n.ocupacion[0]).toContain('ocupado al 50%');
        expect(n.ocupacion[0]).toContain('310 noches');
        expect(n.ocupacion[0]).toContain('620');
        expect(n.ocupacion[0]).toContain('31 días');
    });

    it('nombra el día más lleno y el más vacío', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                busiest: { date: new Date(2026, 7, 15), occupied: 18 },
                quietest: { date: new Date(2026, 7, 3), occupied: 2 },
            }),
        }));
        expect(n.ocupacion.join(' ')).toContain('15 de agosto');
        expect(n.ocupacion.join(' ')).toContain('3 de agosto');
    });

    // Un mes plano no tiene "día más lleno": decirlo sería inventar un pico.
    it('se calla los extremos si todos los días fueron iguales', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                busiest: { date: new Date(2026, 7, 1), occupied: 10 },
                quietest: { date: new Date(2026, 7, 9), occupied: 10 },
            }),
        }));
        expect(n.ocupacion.join(' ')).not.toContain('más lleno');
    });

    it('detecta que el movimiento es de fin de semana', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                byDay: dias(d => (d.getDay() === 5 || d.getDay() === 6 ? 18 : 4)),
            }),
        }));
        expect(n.ocupacion.join(' ')).toContain('movimiento es de fin de semana');
    });

    it('lo dice al revés cuando se vende más entre semana', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                byDay: dias(d => (d.getDay() === 5 || d.getDay() === 6 ? 2 : 16)),
            }),
        }));
        expect(n.ocupacion.join(' ')).toContain('más entre semana');
    });

    // Dos puntos de diferencia no son un patrón: llamarlo "movimiento de fin de
    // semana" haría tomar decisiones sobre ruido.
    it('con diferencia chica dice que se vendió parejo', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                byDay: dias(d => (d.getDay() === 5 || d.getDay() === 6 ? 11 : 10)),
            }),
        }));
        expect(n.ocupacion.join(' ')).toContain('parejo');
    });

    // En una semana suelta no hay con qué comparar.
    it('no compara findes si el período no tiene los dos tipos de día', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({
                byDay: [{ date: new Date(2026, 7, 1), occupied: 10 }], // sábado solo
            }),
        }));
        expect(n.ocupacion.join(' ')).not.toContain('fin de semana');
        expect(n.ocupacion.join(' ')).not.toContain('parejo');
    });

    it('cuenta la gente que llegó y cuánto se quedó', () => {
        const n = narrateMonth(entrada());
        expect(n.ocupacion.join(' ')).toContain('40 reservas con 88 personas');
        expect(n.ocupacion.join(' ')).toContain('2,5 noches en promedio');
    });

    it('habla en presente cuando el mes todavía no terminó', () => {
        const n = narrateMonth(entrada({ isPartial: true }));
        expect(n.ocupacion[0]).toContain('viene estando');
    });

    it('sin habitaciones cargadas no calcula una ocupación falsa', () => {
        const n = narrateMonth(entrada({
            occupancy: ocupacion({ byDay: [], nightsAvailable: 0, rate: 0, daysCounted: 0 }),
        }));
        expect(n.ocupacion[0]).toContain('No hay habitaciones cargadas');
    });
});

describe('el párrafo de plata', () => {
    it('dice qué entró, qué salió y con cuánto cerró', () => {
        const n = narrateMonth(entrada());
        expect(n.plata[0]).toContain('$1.000.000');
        expect(n.plata[0]).toContain('$200.000');
        expect(n.plata[0]).toContain('$800.000 a favor');
    });

    it('lo dice en contra cuando el resultado es negativo', () => {
        const n = narrateMonth(entrada({ result: -50000 }));
        expect(n.plata[0]).toContain('$50.000 en contra');
        // Y sin signo menos duplicado.
        expect(n.plata[0]).not.toContain('-$');
    });

    it('saca lo que dejó cada noche vendida', () => {
        const n = narrateMonth(entrada());
        // 900.000 / 310 noches
        expect(n.plata.join(' ')).toContain('$2.903');
    });

    it('un mes sin movimientos no divide por cero', () => {
        const n = narrateMonth(entrada({
            income: { byMethod: {}, total: 0, fromBookings: 0, fromOther: 0, fromAccounts: 0, toAccounts: 0 },
            expenses: { byType: {}, byMethod: {}, cash: 0, cashRecaudacion: 0, cashEmpresa: 0, empresa: 0, unspecified: 0, total: 0 },
            result: 0,
        }));
        expect(n.plata[0]).toContain('No hay movimientos');
        expect(texto(entrada())).not.toContain('NaN');
    });
});

describe('lo que conviene mirar', () => {
    it('en un mes normal no señala nada', () => {
        expect(narrateMonth(entrada()).atencion).toEqual([]);
    });

    it('avisa de la plata que quedó en cuenta corriente', () => {
        const base = entrada();
        const n = narrateMonth({
            ...base,
            income: { ...base.income, toAccounts: 300000 },
        });
        expect(n.atencion.join(' ')).toContain('$300.000 cargados a cuenta corriente');
    });

    it('avisa de los gastos sin forma de pago', () => {
        const base = entrada();
        const n = narrateMonth({
            ...base,
            expenses: { ...base.expenses, unspecified: 45000 },
        });
        expect(n.atencion.join(' ')).toContain('sin forma de pago');
    });

    it('señala el tipo de habitación que se está quedando sin vender', () => {
        const n = narrateMonth(entrada({
            byType: [
                { roomTypeId: 't1', label: 'Doble', rooms: 12, nightsSold: 300, nightsAvailable: 372, rate: 80 },
                { roomTypeId: 't2', label: 'Suite', rooms: 4, nightsSold: 20, nightsAvailable: 124, rate: 16 },
            ],
        }));
        expect(n.atencion.join(' ')).toContain('Suite');
        expect(n.atencion.join(' ')).toContain('16%');
    });

    it('no señala un tipo que anda parecido al hotel', () => {
        const n = narrateMonth(entrada({
            byType: [
                { roomTypeId: 't1', label: 'Doble', rooms: 12, nightsSold: 300, nightsAvailable: 620, rate: 48 },
            ],
        }));
        expect(n.atencion).toEqual([]);
    });

    it('avisa cuando se cae una porción grande de las reservas', () => {
        const n = narrateMonth(entrada({
            guests: { arrivals: 30, people: 60, lost: 10, avgNights: 2 },
        }));
        expect(n.atencion.join(' ')).toContain('Se cayeron 10 reservas de 40');
        expect(n.atencion.join(' ')).toContain('25%');
    });

    it('dos canceladas de cuarenta no son una alarma', () => {
        expect(narrateMonth(entrada()).atencion).toEqual([]);
    });

    it('muestra lo que se llevó el personal de la heladera, al costo', () => {
        const n = narrateMonth(entrada({
            minibar: summarizeMovements([{
                id: 'm-1', itemId: 'i-1', kind: 'CONSUMO_PERSONAL', quantity: -14,
                unitPrice: 0, unitCost: 900, staffName: 'Ana', createdAt: new Date(),
            }]),
        }));
        expect(n.atencion.join(' ')).toContain('14 productos');
        expect(n.atencion.join(' ')).toContain('$12.600 al costo');
    });

    it('avisa de las mermas aparte del consumo', () => {
        const n = narrateMonth(entrada({
            minibar: summarizeMovements([{
                id: 'm-1', itemId: 'i-1', kind: 'MERMA', quantity: -3,
                unitPrice: 0, unitCost: 500, createdAt: new Date(),
            }]),
        }));
        expect(n.atencion.join(' ')).toContain('por vencimiento o rotura');
        expect(n.atencion.join(' ')).toContain('$1.500');
    });

    it('el mes en rojo es lo primero que se dice', () => {
        const n = narrateMonth(entrada({ result: -120000 }));
        expect(n.atencion[0]).toContain('cierra en rojo');
    });
});

describe('la redacción', () => {
    it('usa singular cuando corresponde', () => {
        const n = narrateMonth(entrada({
            guests: { arrivals: 1, people: 1, lost: 0, avgNights: 0 },
            occupancy: ocupacion({ halfDays: 1 }),
        }));
        const t = n.ocupacion.join(' ');
        expect(t).toContain('1 reserva con 1 persona');
        expect(t).toContain('1 media estadía');
        expect(t).not.toContain('1 reservas');
        expect(t).not.toContain('1 medias');
    });

    it('nunca deja un NaN ni un undefined suelto', () => {
        const casos = [
            entrada(),
            entrada({ result: -1 }),
            entrada({ occupancy: ocupacion({ byDay: [], nightsAvailable: 0, rate: 0, daysCounted: 0 }) }),
            entrada({ guests: { arrivals: 0, people: 0, lost: 0, avgNights: 0 } }),
        ];
        for (const caso of casos) {
            const t = texto(caso);
            expect(t).not.toContain('NaN');
            expect(t).not.toContain('undefined');
            expect(t).not.toContain('Infinity');
        }
    });
});
