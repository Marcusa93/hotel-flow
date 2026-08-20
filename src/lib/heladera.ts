import type { MinibarItem, MinibarMovement, MinibarMovementKind } from '@/types/hotel';

/**
 * Las cuentas de la heladera.
 *
 * Puro a propósito: de acá salen el stock, el margen y cuánto se llevó el
 * personal, y eso se prueba sin base de por medio.
 */

export const MOVEMENT_KIND_LABELS: Record<MinibarMovementKind, string> = {
  COMPRA: 'Reposición',
  VENTA_HUESPED: 'Venta a huésped',
  VENTA_MOSTRADOR: 'Venta de mostrador',
  CONSUMO_PERSONAL: 'Consumo del personal',
  MERMA: 'Merma',
  AJUSTE: 'Ajuste por recuento',
};

export const CATEGORY_LABELS: Record<MinibarItem['category'], string> = {
  bebida: 'Bebidas',
  alcohol: 'Alcohol',
  snack: 'Snacks',
  otro: 'Otros',
};

/** El orden en que se muestran las categorías: como está la heladera. */
export const CATEGORY_ORDER: MinibarItem['category'][] = ['bebida', 'alcohol', 'snack', 'otro'];

/** Los que sacan mercadería. El ajuste no está: puede ir para cualquier lado. */
export const SALIDAS: MinibarMovementKind[] = [
  'VENTA_HUESPED', 'VENTA_MOSTRADOR', 'CONSUMO_PERSONAL', 'MERMA',
];

// ─── El producto ─────────────────────────────────────────────────────

export type StockStatus = 'sin-stock' | 'negativo' | 'bajo' | 'ok';

/**
 * Cómo está parado un producto.
 *
 * El negativo no es un error a esconder: significa que se vendió algo que la
 * app no sabía que había, casi siempre porque nadie cargó la reposición.
 */
export function stockStatus(item: Pick<MinibarItem, 'stock' | 'lowStockThreshold'>): StockStatus {
  if (item.stock < 0) return 'negativo';
  if (item.stock === 0) return 'sin-stock';
  if (item.lowStockThreshold != null && item.stock <= item.lowStockThreshold) return 'bajo';
  return 'ok';
}

/**
 * Lo que paga el personal por una unidad.
 *
 * Sin precio de empleado cargado el producto es cortesía: se descuenta de la
 * heladera y no genera plata. Es la decisión de producto, no un dato faltante.
 */
export function staffUnitPrice(item: Pick<MinibarItem, 'staffPrice'>): number {
  return item.staffPrice ?? 0;
}

/** Ganancia por unidad vendida a un huésped. Sin costo cargado no se puede saber. */
export function unitMargin(item: Pick<MinibarItem, 'price' | 'cost'>): number | null {
  if (item.cost == null) return null;
  return item.price - item.cost;
}

// ─── Los movimientos ─────────────────────────────────────────────────

/** Unidades del movimiento, sin el signo. */
export function units(movement: Pick<MinibarMovement, 'quantity'>): number {
  return Math.abs(movement.quantity);
}

/** Plata que movió: unidades por el precio que se congeló ese día. */
export function movementAmount(movement: Pick<MinibarMovement, 'quantity' | 'unitPrice'>): number {
  return units(movement) * movement.unitPrice;
}

/** Lo que le costó al hotel, si el producto tenía costo cargado. */
export function movementCost(movement: Pick<MinibarMovement, 'quantity' | 'unitCost'>): number {
  return movement.unitCost == null ? 0 : units(movement) * movement.unitCost;
}

export interface MinibarSummary {
  /** Vendido a huéspedes, cargado a la cuenta de la reserva. */
  ventaHuesped: { unidades: number; total: number };
  /** Vendido en el momento, cobrado en el mostrador. */
  ventaMostrador: { unidades: number; total: number };
  /**
   * Lo que se llevó el personal. `cobrado` es lo que quedó registrado a cobrar
   * (cero si es cortesía) y `costo` lo que le salió al hotel igual.
   */
  consumoPersonal: { unidades: number; cobrado: number; costo: number };
  merma: { unidades: number; costo: number };
  compras: { unidades: number; total: number };
  /** Todo lo vendido, a huésped y en mostrador. */
  ventaTotal: number;
  /** Costo de todo lo que salió vendido. Sin costos cargados queda en cero. */
  costoVendido: number;
  /** Venta menos costo de lo vendido. Sin costos cargados es igual a la venta. */
  margen: number;
}

const emptySummary = (): MinibarSummary => ({
  ventaHuesped: { unidades: 0, total: 0 },
  ventaMostrador: { unidades: 0, total: 0 },
  consumoPersonal: { unidades: 0, cobrado: 0, costo: 0 },
  merma: { unidades: 0, costo: 0 },
  compras: { unidades: 0, total: 0 },
  ventaTotal: 0,
  costoVendido: 0,
  margen: 0,
});

/**
 * Cómo le fue a la heladera en un período.
 *
 * El ajuste no entra en ningún total: corrige el stock contra lo que hay
 * físicamente, y no es ni una venta ni una pérdida que se pueda atribuir.
 */
export function summarizeMovements(movements: MinibarMovement[]): MinibarSummary {
  const s = emptySummary();

  for (const m of movements) {
    const u = units(m);
    switch (m.kind) {
      case 'VENTA_HUESPED':
        s.ventaHuesped.unidades += u;
        s.ventaHuesped.total += movementAmount(m);
        s.costoVendido += movementCost(m);
        break;
      case 'VENTA_MOSTRADOR':
        s.ventaMostrador.unidades += u;
        s.ventaMostrador.total += movementAmount(m);
        s.costoVendido += movementCost(m);
        break;
      case 'CONSUMO_PERSONAL':
        s.consumoPersonal.unidades += u;
        s.consumoPersonal.cobrado += movementAmount(m);
        s.consumoPersonal.costo += movementCost(m);
        break;
      case 'MERMA':
        s.merma.unidades += u;
        s.merma.costo += movementCost(m);
        break;
      case 'COMPRA':
        s.compras.unidades += u;
        s.compras.total += movementCost(m);
        break;
      case 'AJUSTE':
        break;
    }
  }

  s.ventaTotal = s.ventaHuesped.total + s.ventaMostrador.total;
  s.margen = s.ventaTotal - s.costoVendido;
  return s;
}

// ─── El personal ─────────────────────────────────────────────────────

/**
 * El nombre con el que se agrupa a una persona.
 *
 * El campo es texto libre —hay personal sin usuario en la app, igual que en
 * limpieza—, así que "Juan", "juan " y "JUAN" tienen que ser el mismo total.
 * Los acentos también se sacan: entre tres turnos, "Martín" y "Martin" son la
 * misma persona y partirla en dos totales haría inútil el número.
 */
export function normalizeStaffName(name: string | undefined): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface StaffConsumption {
  /** El nombre tal como se escribió la última vez. */
  name: string;
  profileId?: string;
  unidades: number;
  /** Lo que quedó registrado a cobrarle. Cero si todo fue cortesía. */
  aCobrar: number;
  /** Lo que le costó al hotel, se cobre o no. */
  costo: number;
  ultimoConsumo: Date;
}

/**
 * Cuánto se llevó cada uno, de mayor a menor.
 *
 * Esto es el registro, no una cuenta corriente: el hotel decide después qué
 * hace con el total —descontarlo, perdonarlo, cobrarlo—, y esa decisión no
 * vive acá.
 */
export function staffConsumption(movements: MinibarMovement[]): StaffConsumption[] {
  const byPerson = new Map<string, StaffConsumption>();

  for (const m of movements) {
    if (m.kind !== 'CONSUMO_PERSONAL') continue;
    const key = normalizeStaffName(m.staffName);
    if (!key) continue;

    const current = byPerson.get(key);
    const createdAt = new Date(m.createdAt);
    if (current) {
      current.unidades += units(m);
      current.aCobrar += movementAmount(m);
      current.costo += movementCost(m);
      if (createdAt > current.ultimoConsumo) {
        current.ultimoConsumo = createdAt;
        current.name = (m.staffName || '').trim();
        current.profileId = m.staffProfileId ?? current.profileId;
      }
    } else {
      byPerson.set(key, {
        name: (m.staffName || '').trim(),
        profileId: m.staffProfileId,
        unidades: units(m),
        aCobrar: movementAmount(m),
        costo: movementCost(m),
        ultimoConsumo: createdAt,
      });
    }
  }

  return Array.from(byPerson.values()).sort(
    (a, b) => b.unidades - a.unidades || a.name.localeCompare(b.name, 'es'),
  );
}

/**
 * Los nombres ya usados, para sugerirlos al cargar un consumo.
 *
 * Evita que la misma persona termine partida en tres totales por una letra.
 */
export function knownStaffNames(movements: MinibarMovement[]): string[] {
  return staffConsumption(movements).map((s) => s.name);
}

// ─── La heladera entera ──────────────────────────────────────────────

export interface InventoryValue {
  unidades: number;
  /** Lo que costó lo que hay adentro. Sólo cuenta los que tienen costo cargado. */
  alCosto: number;
  /** Lo que vale si se vende todo. */
  aVenta: number;
  /** Cuántos productos no tienen costo cargado, y por eso no suman al costo. */
  sinCosto: number;
}

export function inventoryValue(items: MinibarItem[]): InventoryValue {
  const value: InventoryValue = { unidades: 0, alCosto: 0, aVenta: 0, sinCosto: 0 };

  for (const item of items) {
    // El stock negativo no vale plata: es un faltante de carga, no mercadería.
    const stock = Math.max(0, item.stock);
    value.unidades += stock;
    value.aVenta += stock * item.price;
    if (item.cost == null) {
      if (stock > 0) value.sinCosto += 1;
    } else {
      value.alCosto += stock * item.cost;
    }
  }

  return value;
}

/** Los que hay que reponer: sin stock, en rojo, o por debajo del aviso. */
export function needsRestock(items: MinibarItem[]): MinibarItem[] {
  return items
    .filter((i) => i.isActive && stockStatus(i) !== 'ok')
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'es'));
}
