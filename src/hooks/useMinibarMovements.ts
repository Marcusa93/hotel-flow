import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  mapBookingCharge, mapMinibarMovement, mapOtherIncome, minibarMovementToRow,
} from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';
import { MOVEMENT_KIND_LABELS, normalizeStaffName, units } from '@/lib/heladera';
import type {
  MinibarItem, MinibarMovement, MinibarMovementKind, SettlementMethod,
} from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';

/**
 * Las entradas y salidas de la heladera.
 *
 * Cada movimiento mueve el stock del producto: eso lo hace un trigger en la
 * base, no este archivo. Acá sólo se arma el renglón.
 */

/** El cheque no entra: other_income no lo acepta, y nadie paga una lata así. */
export type CounterSaleMethod = Exclude<SettlementMethod, 'CHEQUE'>;

interface UseMinibarMovementsOptions {
  /** Desde cuándo, inclusive. Sin esto trae los últimos 500. */
  from?: Date;
  /** Hasta cuándo, inclusive. */
  to?: Date;
  itemId?: string;
}

const DEFAULT_LIMIT = 500;

export const useMinibarMovements = ({ from, to, itemId }: UseMinibarMovementsOptions = {}) => {
  return useQuery({
    queryKey: [
      'minibar-movements',
      from ? formatLocalDate(from) : null,
      to ? formatLocalDate(to) : null,
      itemId ?? null,
    ],
    queryFn: async (): Promise<MinibarMovement[]> => {
      let query = supabase.from('minibar_movements').select('*');

      if (from) query = query.gte('created_at', from.toISOString());
      if (to) query = query.lte('created_at', to.toISOString());
      if (itemId) query = query.eq('item_id', itemId);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(DEFAULT_LIMIT);

      if (error) throw error;
      return (data || []).map(mapMinibarMovement);
    },
    staleTime: 30 * 1000,
  });
};

/**
 * Los nombres del personal ya usados, del más reciente al más viejo.
 *
 * Va aparte de la lista de movimientos porque las sugerencias no dependen del
 * mes que se esté mirando: en el primer consumo de un mes nuevo la lista tiene
 * que estar igual, o cada uno escribe el nombre como se le ocurre.
 */
export const useKnownStaffNames = () =>
  useQuery({
    queryKey: ['minibar-staff-names'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('minibar_movements')
        .select('staff_name, created_at')
        .eq('kind', 'CONSUMO_PERSONAL')
        .not('staff_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const vistos = new Set<string>();
      const nombres: string[] = [];
      for (const row of data || []) {
        const nombre = (row.staff_name as string | null)?.trim();
        if (!nombre) continue;
        const clave = normalizeStaffName(nombre);
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        nombres.push(nombre);
      }
      return nombres;
    },
    staleTime: 5 * 60 * 1000,
  });

/** Todo lo que se invalida cuando la heladera se mueve. */
const invalidateHeladera = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['minibar-movements'] });
  queryClient.invalidateQueries({ queryKey: ['minibar-items'] });
  queryClient.invalidateQueries({ queryKey: ['minibar-staff-names'] });
};

const describeMovement = (item: Pick<MinibarItem, 'name'>, m: Pick<MinibarMovement, 'kind' | 'quantity'>) =>
  `${MOVEMENT_KIND_LABELS[m.kind]}: ${units(m)} × ${item.name}`;

// ─── Movimiento simple ───────────────────────────────────────────────

export interface SimpleMovementInput {
  item: MinibarItem;
  /** Reposición, merma, ajuste o consumo del personal. Las ventas van aparte. */
  kind: Extract<MinibarMovementKind, 'COMPRA' | 'MERMA' | 'AJUSTE' | 'CONSUMO_PERSONAL'>;
  /** Con signo, igual que en la base: positivo entra, negativo sale. */
  quantity: number;
  /** Sólo en consumo del personal. Cero si el producto es cortesía. */
  unitPrice?: number;
  /** En una reposición, lo que costó esta vez. Por defecto, el costo del producto. */
  unitCost?: number;
  staffName?: string;
  staffProfileId?: string;
  notes?: string;
}

export const useCreateMinibarMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SimpleMovementInput): Promise<MinibarMovement> => {
      const { data, error } = await supabase
        .from('minibar_movements')
        .insert(minibarMovementToRow({
          itemId: input.item.id,
          kind: input.kind,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? 0,
          unitCost: input.unitCost ?? input.item.cost,
          staffName: input.staffName,
          staffProfileId: input.staffProfileId,
          notes: input.notes,
        }))
        .select()
        .single();

      if (error) throw error;
      return mapMinibarMovement(data);
    },
    onSuccess: (movement, input) => {
      invalidateHeladera(queryClient);
      logAuditEvent({
        entityType: 'minibar_movement',
        entityId: movement.id,
        action: 'CREATE',
        description: input.staffName
          ? `${describeMovement(input.item, movement)} — ${input.staffName}`
          : describeMovement(input.item, movement),
        newValues: {
          item: input.item.name, kind: movement.kind, quantity: movement.quantity,
          unitPrice: movement.unitPrice, staffName: movement.staffName,
        },
      });
    },
  });
};

// ─── Venta de mostrador ──────────────────────────────────────────────

/**
 * El cobro entró pero el stock no se movió.
 *
 * Son dos escrituras separadas —no hay transacción desde el navegador— y si se
 * corta entre una y otra, la plata es lo que no se puede perder. Por eso el
 * ingreso va primero y esto avisa que falta el descuento, que se arregla con un
 * recuento. La heladera física siempre gana.
 */
export class StockNoDescontadoError extends Error {
  // Propia y no `Error.cause`, que es ES2022 y el target de la app es ES2020.
  readonly motivo?: unknown;

  constructor(readonly otherIncomeId: string, motivo?: unknown) {
    super('Se registró el cobro pero no se pudo descontar el stock.');
    this.name = 'StockNoDescontadoError';
    this.motivo = motivo;
  }
}

export interface CounterSaleLine {
  item: MinibarItem;
  quantity: number;
}

export interface CounterSaleInput {
  lines: CounterSaleLine[];
  method: CounterSaleMethod;
  notes?: string;
}

const describeSale = (lines: CounterSaleLine[]): string => {
  const detalle = lines.map((l) => `${l.quantity} × ${l.item.name}`).join(', ');
  const texto = `Heladera: ${detalle}`;
  // La columna es libre, pero el renglón del cierre se lee en una línea.
  return texto.length > 200 ? `${texto.slice(0, 197)}...` : texto;
};

/**
 * Se vendió algo cobrando en el momento.
 *
 * Genera un ingreso externo —que es lo que ya mira el cierre de caja— y
 * descuenta el stock. Sin el ingreso, el efectivo aparecería en el cajón sin
 * ningún renglón que lo explique.
 */
export const useCounterSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterSaleInput) => {
      const total = input.lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);

      const { data: incomeRow, error: incomeError } = await supabase
        .from('other_income')
        .insert({
          // El cierre corta por created_at, así que la fecha es sólo el día.
          date: formatLocalDate(new Date()),
          description: describeSale(input.lines),
          method: input.method,
          amount: total,
        })
        .select()
        .single();

      if (incomeError) throw incomeError;
      const income = mapOtherIncome(incomeRow);

      const { data: movementRows, error: movementError } = await supabase
        .from('minibar_movements')
        .insert(input.lines.map((l) => minibarMovementToRow({
          itemId: l.item.id,
          kind: 'VENTA_MOSTRADOR',
          quantity: -l.quantity,
          unitPrice: l.item.price,
          unitCost: l.item.cost,
          otherIncomeId: income.id,
          notes: input.notes,
        })))
        .select();

      if (movementError) throw new StockNoDescontadoError(income.id, movementError);

      return { income, movements: (movementRows || []).map(mapMinibarMovement), total };
    },
    onSuccess: ({ income, total }, input) => {
      invalidateHeladera(queryClient);
      queryClient.invalidateQueries({ queryKey: ['otherIncome'] });
      queryClient.invalidateQueries({ queryKey: ['revenueStats'] });
      logAuditEvent({
        entityType: 'minibar_movement',
        entityId: income.id,
        action: 'CREATE',
        description: `${describeSale(input.lines)} — $${total.toLocaleString('es-AR')} (${input.method})`,
        newValues: { total, method: input.method, otherIncomeId: income.id },
      });
    },
    onError: (error, _input, _ctx) => {
      // El ingreso quedó cargado aunque el stock no: la caja tiene que verlo.
      if (error instanceof StockNoDescontadoError) {
        queryClient.invalidateQueries({ queryKey: ['otherIncome'] });
      }
    },
  });
};

// ─── Consumo del huésped ─────────────────────────────────────────────

/**
 * El cargo quedó en la cuenta pero el stock no bajó.
 *
 * Mismo criterio que en la venta de mostrador: primero la plata, que es lo que
 * no se puede perder, y el stock se corrige con un recuento.
 */
export class ConsumoSinDescontarError extends Error {
  readonly motivo?: unknown;

  constructor(motivo?: unknown) {
    super('Se cargó el consumo a la cuenta pero no se pudo descontar el stock.');
    this.name = 'ConsumoSinDescontarError';
    this.motivo = motivo;
  }
}

export interface GuestConsumptionInput {
  bookingId: string;
  lines: CounterSaleLine[];
}

/**
 * Se llevaron algo a la habitación: va a la cuenta de la reserva.
 *
 * Es el circuito que ya existía desde la reserva; lo único nuevo es que ahora
 * también descuenta de la heladera.
 */
export const useGuestConsumption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, lines }: GuestConsumptionInput) => {
      const { data: chargeRows, error: chargeError } = await supabase
        .from('booking_charges')
        .insert(lines.map((l) => ({
          booking_id: bookingId,
          category: 'MINIBAR',
          description: l.item.name,
          amount: l.item.price,
          quantity: l.quantity,
        })))
        .select();

      if (chargeError) throw chargeError;

      const charges = (chargeRows || []).map(mapBookingCharge);
      // El cargo se busca por producto y no por posición: el insert masivo no
      // promete devolver las filas en el orden en que se mandaron.
      const chargeByName = new Map(charges.map((c) => [c.description, c.id]));

      const { data: movementRows, error: movementError } = await supabase
        .from('minibar_movements')
        .insert(lines.map((l) => minibarMovementToRow({
          itemId: l.item.id,
          kind: 'VENTA_HUESPED',
          quantity: -l.quantity,
          unitPrice: l.item.price,
          unitCost: l.item.cost,
          bookingId,
          bookingChargeId: chargeByName.get(l.item.name),
        })))
        .select();

      if (movementError) throw new ConsumoSinDescontarError(movementError);

      const total = lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
      return { charges, movements: (movementRows || []).map(mapMinibarMovement), total };
    },
    onSuccess: ({ charges }) => {
      invalidateHeladera(queryClient);
      queryClient.invalidateQueries({ queryKey: ['bookingCharges'] });
      // Un renglón por cargo, igual que cuando los cargaba useCreateBookingCharge.
      for (const charge of charges) {
        logAuditEvent({
          entityType: 'booking_charge',
          entityId: charge.id,
          action: 'CREATE',
          description: `Cargo agregado: MINIBAR - ${charge.description} ($${(charge.amount * charge.quantity).toLocaleString('es-AR')})`,
          newValues: {
            category: charge.category, amount: charge.amount,
            quantity: charge.quantity, description: charge.description,
          },
        });
      }
    },
    onError: (error, _input, _ctx) => {
      // Los cargos quedaron: la cuenta de la reserva tiene que mostrarlos.
      if (error instanceof ConsumoSinDescontarError) {
        queryClient.invalidateQueries({ queryKey: ['bookingCharges'] });
      }
    },
  });
};

// ─── Deshacer ────────────────────────────────────────────────────────

/**
 * Borra un movimiento y devuelve el stock.
 *
 * Es para el que se cargó mal recién. No toca el cargo de la reserva ni el
 * ingreso de caja que lo hayan originado: esa plata se corrige donde vive.
 */
export const useDeleteMinibarMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ movement }: { movement: MinibarMovement; itemName: string }) => {
      const { error } = await supabase.from('minibar_movements').delete().eq('id', movement.id);
      if (error) throw error;
    },
    onSuccess: (_data, { movement, itemName }) => {
      invalidateHeladera(queryClient);
      logAuditEvent({
        entityType: 'minibar_movement',
        entityId: movement.id,
        action: 'DELETE',
        description: `Movimiento de heladera borrado: ${describeMovement({ name: itemName }, movement)}`,
        oldValues: {
          item: itemName, kind: movement.kind,
          quantity: movement.quantity, unitPrice: movement.unitPrice,
        },
      });
    },
  });
};
