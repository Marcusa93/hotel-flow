import { LOGBOOK_CATEGORY_LABELS } from '@/lib/constants';
import type { LogbookEntry } from '@/types/hotel';

/**
 * Filtros y armado de texto de la planilla de novedades.
 *
 * Puro a propósito: la pantalla filtra en memoria —la planilla de un hotel de
 * este tamaño entra entera— y así los casos raros se prueban sin base.
 */

export interface LogbookFilters {
  /** 'ALL' o una LogbookCategory */
  category: string;
  /** 'ALL' o un LogbookStatus */
  status: string;
  /** 'ALL' o el id de una habitación; matchea contra origen y destino */
  roomId: string;
  search: string;
}

export const EMPTY_LOGBOOK_FILTERS: LogbookFilters = {
  category: 'ALL',
  status: 'ALL',
  roomId: 'ALL',
  search: '',
};

/**
 * De dónde a dónde, en el idioma en que se dice en el mostrador.
 *
 * Las dos habitaciones son opcionales y cada combinación se lee distinto: "de
 * la 202 a la 210" es un movimiento, "en la 305" es algo que pasó ahí, y "a la
 * 210" es algo que llegó sin que importe de dónde.
 */
export function describeRoomMovement(
  fromNumber?: string,
  toNumber?: string
): string | null {
  if (fromNumber && toNumber) return `De la ${fromNumber} a la ${toNumber}`;
  if (fromNumber) return `En la ${fromNumber}`;
  if (toNumber) return `A la ${toNumber}`;
  return null;
}

/** Sin tildes y en minúscula: en el buscador "habitacion" tiene que encontrar "habitación". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function filterLogbookEntries(
  entries: LogbookEntry[],
  filters: LogbookFilters,
  roomNumberById: Record<string, string> = {}
): LogbookEntry[] {
  const search = normalize(filters.search.trim());

  return entries.filter(entry => {
    if (filters.category !== 'ALL' && entry.category !== filters.category) return false;
    if (filters.status !== 'ALL' && entry.status !== filters.status) return false;

    // Una habitación matchea esté en el origen o en el destino: buscando la 210
    // interesan tanto lo que salió como lo que entró.
    if (
      filters.roomId !== 'ALL' &&
      entry.roomFromId !== filters.roomId &&
      entry.roomToId !== filters.roomId
    ) {
      return false;
    }

    if (!search) return true;

    // El texto busca por todo lo que se ve en la tarjeta: si está en pantalla,
    // se tiene que poder encontrar.
    const haystack = normalize([
      entry.note,
      LOGBOOK_CATEGORY_LABELS[entry.category] || entry.category,
      entry.createdByName || '',
      entry.resolvedByName || '',
      entry.roomFromId ? roomNumberById[entry.roomFromId] || '' : '',
      entry.roomToId ? roomNumberById[entry.roomToId] || '' : '',
    ].join(' '));

    return haystack.includes(search);
  });
}

/** Lo pendiente primero y después por fecha: es lo que la pantalla tiene que gritar. */
export function sortLogbookEntries(entries: LogbookEntry[]): LogbookEntry[] {
  return [...entries].sort((a, b) => {
    const aPending = a.status === 'PENDING' ? 0 : 1;
    const bPending = b.status === 'PENDING' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.date.getTime() - a.date.getTime();
  });
}

/** Cuántas quedaron sin levantar. Va en el título de la pantalla y en el menú. */
export function countPending(entries: LogbookEntry[]): number {
  return entries.filter(e => e.status === 'PENDING').length;
}
