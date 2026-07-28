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
  CREDIT: 'T. Crédito',
  DEBIT: 'T. Débito',
  TRANSFER: 'Transferencia',
  QR: 'QR',
  OTHER: 'Otro',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  // Legacy value kept so old rows/labels don't render blank
  CARD: 'Tarjeta',
};

/**
 * Los métodos con los que entra plata. Es la lista de los selects y de los
 * reportes de caja.
 *
 * CUENTA_CORRIENTE queda afuera a propósito: no es una forma de cobrar sino de
 * no cobrar todavía. Se ofrece aparte, y solo al huésped que la tiene
 * habilitada. Metida acá se podría elegir para un ingreso suelto o un gasto,
 * donde no significa nada, y el cierre de caja la sumaría al total del día.
 */
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CREDIT', label: 'T. Crédito' },
  { value: 'DEBIT', label: 'T. Débito' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'QR', label: 'QR' },
  { value: 'OTHER', label: 'Otro' },
];

/** El método que no cobra: carga la estadía a la cuenta del huésped. */
export const CURRENT_ACCOUNT_METHOD = 'CUENTA_CORRIENTE';

/**
 * Cómo se portó el huésped. Es para la interna del hotel: no se imprime en la
 * ficha ni sale en las exportaciones.
 *
 * Tres niveles y no dos: entre "todo bien" y "no lo quiero más" está el que dio
 * trabajo pero se le puede alquilar de nuevo avisando, que es el caso más común
 * y el que se perdería con un sí/no.
 */
export const GUEST_RATINGS = [
  {
    value: 'BUENO',
    label: 'Buen huésped',
    hint: 'Todo bien. Vuelve cuando quiera.',
  },
  {
    value: 'ATENCION',
    label: 'Con reparos',
    hint: 'Dio trabajo. Se le puede alquilar, pero avisando.',
  },
  {
    value: 'NO_DESEADO',
    label: 'No deseado',
    hint: 'No conviene volver a alojarlo.',
  },
] as const;

export const GUEST_RATING_LABELS: Record<string, string> = {
  BUENO: 'Buen huésped',
  ATENCION: 'Con reparos',
  NO_DESEADO: 'No deseado',
};

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  PANADERIA: 'Panadería',
  SUPERMERCADO: 'Supermercado',
  VERDULERIA: 'Verdulería',
  CARNICERIA: 'Carnicería',
  BEBIDAS: 'Bebidas',
  LIMPIEZA: 'Limpieza',
  MANTENIMIENTO: 'Mantenimiento',
  SERVICIOS: 'Servicios (Luz, Gas, Agua)',
  OTROS: 'Otros',
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
  { value: 'ALOJAMIENTO', label: 'Alojamiento', icon: '🛏️' },
  { value: 'OTRO', label: 'Otro', icon: '📋' },
] as const;

/**
 * Las categorías que la recepción puede elegir a mano en "Nuevo cargo".
 *
 * ALOJAMIENTO queda afuera a propósito: lo emite "Extender estadía", que además
 * corre la fecha de salida de la reserva. Cargado suelto cobraría las noches
 * pero dejaría la habitación figurando libre desde la salida original, que es
 * exactamente cómo se sobrevende una habitación ocupada.
 */
export const MANUAL_CHARGE_CATEGORIES = CHARGE_CATEGORIES.filter(
  c => c.value !== 'ALOJAMIENTO'
);
