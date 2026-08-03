import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Date as YYYY-MM-DD in the local timezone (not UTC) */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight instead of UTC.
 *
 * Inversa de formatLocalDate: las dos leen y escriben el calendario local. Un
 * `new Date("2026-08-03")` pelado es medianoche UTC, o sea las 21 del día 2 en
 * Argentina, y al volver a formatearlo el día se corre para atrás. Todo lo que
 * venga de un <input type="date"> o de una columna DATE tiene que entrar por acá.
 */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T00:00:00');
  }
  return new Date(value);
}

/**
 * Format a full name as "Apellido, Nombre" for hotel display.
 * "María García López" → "García López, María"
 * "Juan Pérez" → "Pérez, Juan"
 * "Ana" → "Ana" (single word unchanged)
 */
export function formatLastNameFirst(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const lastNames = parts.slice(1).join(' ');
  return `${lastNames}, ${firstName}`;
}

/**
 * Get initials from a full name (first letter of first and last word).
 */
export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * "1 persona" / "4 personas".
 *
 * El singular importa desde que existe el tramo simple: hasta entonces el tipo
 * más chico del hotel era el de dos y el plural fijo nunca se notaba.
 */
export function guestsLabel(count: number): string {
  return `${count} ${count === 1 ? 'persona' : 'personas'}`;
}

/**
 * Cuánto dura la estadía, dicho para la pantalla.
 *
 * La media estadía no tiene noches —entra y sale el mismo día— así que sin esto
 * la ficha decía "0 noches". Va en un solo lugar para que la ficha, el tablero y
 * los carteles de confirmar digan lo mismo.
 */
export function stayLengthLabel(nights: number, isHalfDay = false): string {
  if (isHalfDay) return 'Media estadía';
  return `${nights} ${nights === 1 ? 'noche' : 'noches'}`;
}

/** Escape HTML special characters to prevent XSS in document.write() contexts */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Compact amounts ─────────────────────────────────────────────────
// Stat cards and chart axes are too narrow for a full "$1.603.000", so the
// amount gets abbreviated. Stopping at "k" only works below a million: past
// that it printed "$1603k", which is exactly the digit-counting the card is
// supposed to save you.

/** 1.603.000 → "$1,6M" · 84.000 → "$84k" · 850 → "$850" */
export function formatCompactMoney(amount: number | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  // Round to thousands before choosing the unit, otherwise 999.500 prints as
  // "$1000k" instead of stepping up to "$1M".
  const thousands = abs >= 1000 ? Math.round(abs / 1000) : 0;

  if (thousands >= 1000) {
    // One decimal, dropped when it's exact: "$1,6M" but "$2M", not "$2,0M".
    const millions = (abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 });
    return `${sign}$${millions}M`;
  }
  if (thousands > 0) return `${sign}$${thousands}k`;
  return `${sign}$${Math.round(abs).toLocaleString('es-AR')}`;
}

// ─── Peso amount inputs ──────────────────────────────────────────────
// A bare <input type="number"> shows "160000", which is hard to read at a
// glance. These keep an es-AR formatted string in the field while the form
// still holds a plain number.

/** Number → "160.000" / "160.000,50" for display inside an input. */
export function formatPesosInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (value === 0) return '';
  const hasCents = !Number.isInteger(value);
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Normalizes whatever the user typed into { display, value }.
 * Keeps digits and a single comma so the decimal separator can be typed
 * without the grouping logic swallowing it mid-keystroke.
 */
export function parsePesosInput(raw: string): { display: string; value: number } {
  const cleaned = raw.replace(/[^\d,]/g, '').replace(/,(?=[^,]*,)/g, '');
  const [rawInt = '', rawDec] = cleaned.split(',');

  const intDigits = rawInt.replace(/^0+(?=\d)/, '');
  const grouped = intDigits ? Number(intDigits).toLocaleString('es-AR') : '';
  const dec = rawDec === undefined ? undefined : rawDec.slice(0, 2);

  const display = dec === undefined ? grouped : `${grouped || '0'},${dec}`;
  const value = Number(`${intDigits || '0'}.${dec || '0'}`);

  return { display, value: Number.isFinite(value) ? value : 0 };
}
