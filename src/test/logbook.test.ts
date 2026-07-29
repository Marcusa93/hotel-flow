import { describe, it, expect } from 'vitest';
import {
  EMPTY_LOGBOOK_FILTERS,
  countPending,
  describeRoomMovement,
  filterLogbookEntries,
  sortLogbookEntries,
} from '@/lib/logbook';
import type { LogbookEntry } from '@/types/hotel';

// La planilla de novedades: lo que el turno anota para que el que entra se
// entere. Una toalla que salió de la 305, la bebida que pasó de la 202 a la 210.

const HAB_202 = 'r-202';
const HAB_210 = 'r-210';
const HAB_305 = 'r-305';

const numerosDeHabitacion = {
  [HAB_202]: '202',
  [HAB_210]: '210',
  [HAB_305]: '305',
};

const novedad = (over: Partial<LogbookEntry> = {}): LogbookEntry => ({
  id: 'n-1',
  date: new Date(2026, 6, 28, 10, 0),
  category: 'OTRO',
  note: 'Algo pasó',
  status: 'INFO',
  createdAt: new Date(2026, 6, 28, 10, 0),
  ...over,
});

describe('describeRoomMovement', () => {
  it('con las dos puntas lo lee como un movimiento', () => {
    expect(describeRoomMovement('202', '210')).toBe('De la 202 a la 210');
  });

  it('con solo el origen dice dónde pasó', () => {
    expect(describeRoomMovement('305', undefined)).toBe('En la 305');
  });

  it('con solo el destino dice a dónde fue', () => {
    expect(describeRoomMovement(undefined, '210')).toBe('A la 210');
  });

  it('sin habitaciones no inventa una línea', () => {
    expect(describeRoomMovement(undefined, undefined)).toBeNull();
  });
});

describe('filterLogbookEntries', () => {
  const entries = [
    novedad({ id: 'a', category: 'ROPA_BLANCA', note: 'Se sacó una toalla', roomFromId: HAB_305 }),
    novedad({ id: 'b', category: 'MINIBAR', note: 'Bebida movida', roomFromId: HAB_202, roomToId: HAB_210 }),
    novedad({ id: 'c', category: 'MANTENIMIENTO', note: 'Pérdida en el baño', status: 'PENDING', roomFromId: HAB_210 }),
  ];

  it('sin filtros devuelve todo', () => {
    expect(filterLogbookEntries(entries, EMPTY_LOGBOOK_FILTERS)).toHaveLength(3);
  });

  it('filtra por categoría', () => {
    const result = filterLogbookEntries(entries, { ...EMPTY_LOGBOOK_FILTERS, category: 'MINIBAR' });
    expect(result.map(e => e.id)).toEqual(['b']);
  });

  it('filtra por estado', () => {
    const result = filterLogbookEntries(entries, { ...EMPTY_LOGBOOK_FILTERS, status: 'PENDING' });
    expect(result.map(e => e.id)).toEqual(['c']);
  });

  it('la habitación matchea tanto en el origen como en el destino', () => {
    // La 210 recibió la bebida y además tiene la pérdida: las dos cosas
    // interesan cuando alguien pregunta "¿qué pasó en la 210?".
    const result = filterLogbookEntries(entries, { ...EMPTY_LOGBOOK_FILTERS, roomId: HAB_210 });
    expect(result.map(e => e.id)).toEqual(['b', 'c']);
  });

  it('busca por el texto de la novedad', () => {
    const result = filterLogbookEntries(entries, { ...EMPTY_LOGBOOK_FILTERS, search: 'toalla' });
    expect(result.map(e => e.id)).toEqual(['a']);
  });

  it('busca por número de habitación', () => {
    const result = filterLogbookEntries(
      entries,
      { ...EMPTY_LOGBOOK_FILTERS, search: '305' },
      numerosDeHabitacion
    );
    expect(result.map(e => e.id)).toEqual(['a']);
  });

  it('ignora tildes: "perdida" encuentra "Pérdida"', () => {
    const result = filterLogbookEntries(entries, { ...EMPTY_LOGBOOK_FILTERS, search: 'perdida' });
    expect(result.map(e => e.id)).toEqual(['c']);
  });

  it('busca por quién la anotó', () => {
    const conAutor = [novedad({ id: 'd', createdByName: 'Ana Gómez' })];
    const result = filterLogbookEntries(conAutor, { ...EMPTY_LOGBOOK_FILTERS, search: 'ana' });
    expect(result.map(e => e.id)).toEqual(['d']);
  });

  it('combina filtros en vez de quedarse con el último', () => {
    const result = filterLogbookEntries(entries, {
      ...EMPTY_LOGBOOK_FILTERS,
      category: 'MANTENIMIENTO',
      status: 'INFO',
    });
    expect(result).toHaveLength(0);
  });
});

describe('sortLogbookEntries', () => {
  it('lo pendiente va primero aunque sea más viejo', () => {
    const vieja = novedad({ id: 'vieja', status: 'PENDING', date: new Date(2026, 6, 20) });
    const nueva = novedad({ id: 'nueva', status: 'INFO', date: new Date(2026, 6, 28) });

    expect(sortLogbookEntries([nueva, vieja]).map(e => e.id)).toEqual(['vieja', 'nueva']);
  });

  it('dentro del mismo estado, la más reciente arriba', () => {
    const ayer = novedad({ id: 'ayer', date: new Date(2026, 6, 27) });
    const hoy = novedad({ id: 'hoy', date: new Date(2026, 6, 28) });

    expect(sortLogbookEntries([ayer, hoy]).map(e => e.id)).toEqual(['hoy', 'ayer']);
  });

  it('no toca el array original', () => {
    const original = [novedad({ id: 'a', date: new Date(2026, 6, 20) }), novedad({ id: 'b', date: new Date(2026, 6, 28) })];
    sortLogbookEntries(original);
    expect(original.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('countPending', () => {
  it('cuenta solo lo pendiente: resuelto y anotación no molestan', () => {
    const entries = [
      novedad({ id: 'a', status: 'PENDING' }),
      novedad({ id: 'b', status: 'RESOLVED' }),
      novedad({ id: 'c', status: 'INFO' }),
      novedad({ id: 'd', status: 'PENDING' }),
    ];
    expect(countPending(entries)).toBe(2);
  });
});
