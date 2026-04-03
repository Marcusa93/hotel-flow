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
