// Shared constants for the HoMe App

export const COUNTRIES = [
  { value: 'Argentina', label: '🇦🇷 Argentina' },
  { value: 'Brasil', label: '🇧🇷 Brasil' },
  { value: 'Chile', label: '🇨🇱 Chile' },
  { value: 'Uruguay', label: '🇺🇾 Uruguay' },
  { value: 'Paraguay', label: '🇵🇾 Paraguay' },
  { value: 'Bolivia', label: '🇧🇴 Bolivia' },
  { value: 'Perú', label: '🇵🇪 Perú' },
  { value: 'Colombia', label: '🇨🇴 Colombia' },
  { value: 'Ecuador', label: '🇪🇨 Ecuador' },
  { value: 'Venezuela', label: '🇻🇪 Venezuela' },
  { value: 'México', label: '🇲🇽 México' },
  { value: 'Estados Unidos', label: '🇺🇸 Estados Unidos' },
  { value: 'Canadá', label: '🇨🇦 Canadá' },
  { value: 'España', label: '🇪🇸 España' },
  { value: 'Italia', label: '🇮🇹 Italia' },
  { value: 'Francia', label: '🇫🇷 Francia' },
  { value: 'Alemania', label: '🇩🇪 Alemania' },
  { value: 'Reino Unido', label: '🇬🇧 Reino Unido' },
  { value: 'Portugal', label: '🇵🇹 Portugal' },
  { value: 'Japón', label: '🇯🇵 Japón' },
  { value: 'China', label: '🇨🇳 China' },
  { value: 'Otro', label: '🌍 Otro' },
] as const;

export const DOCUMENT_TYPES = [
  { value: 'DNI', label: 'DNI' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'CEDULA', label: 'Cédula de Identidad' },
  { value: 'CUIT', label: 'CUIT / RUC' },
  { value: 'OTRO', label: 'Otro' },
] as const;

// DocumentType is the canonical type from src/types/hotel.ts — do not re-export here

// --- Status & method labels (used across components, hooks, and pages) ---

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Alojado',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No-show',
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  DIRTY: 'Sucia',
  MAINTENANCE: 'Mantenimiento',
  OUT_OF_ORDER: 'Fuera de servicio',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export const CHARGE_CATEGORIES = [
  { value: 'MINIBAR', label: 'Minibar', icon: '🍫' },
  { value: 'LAVANDERIA', label: 'Lavandería', icon: '👔' },
  { value: 'ESTACIONAMIENTO', label: 'Estacionamiento', icon: '🅿️' },
  { value: 'ROOM_SERVICE', label: 'Room Service', icon: '🍽️' },
  { value: 'RESTAURANT', label: 'Restaurant', icon: '🍷' },
  { value: 'SPA', label: 'Spa', icon: '💆' },
  { value: 'TELEFONO', label: 'Teléfono', icon: '📞' },
  { value: 'DANO', label: 'Daño / Rotura', icon: '⚠️' },
  { value: 'OTRO', label: 'Otro', icon: '📋' },
] as const;
