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
