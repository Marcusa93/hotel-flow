import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCashAdjustment } from '@/lib/mappers';
import { logAuditEvent } from './useCreateAuditLog';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { CashAdjustment, SettlementMethod } from '@/types/hotel';

const QUERY_KEY = ['cashAdjustments'] as const;

/**
 * El error de PostgREST convertido en Error de verdad, igual que en
 * useUpdatePayment: sin esto, el mensaje de la política de permisos llega al
 * mostrador como un texto genérico que no dice qué pasó.
 */
const asError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  const message = (error as { message?: string } | null)?.message;
  return Object.assign(new Error(message || 'No se pudo guardar el ajuste'), error);
};

export const useCashAdjustments = () =>
  useQuery<CashAdjustment[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_adjustments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw asError(error);
      return (data || []).map(mapCashAdjustment);
    },
    staleTime: 30 * 1000,
  });

/** Una pata de un ajuste: a qué método y cuánto, con signo. */
export interface AdjustmentLeg {
  method: SettlementMethod;
  amount: number;
}

interface CreateAdjustmentParams {
  /**
   * Una pata para un retiro o ajuste suelto; dos para un cambio de método
   * (-X en el origen, +X en el destino). Las dos patas se insertan juntas y
   * quedan atadas por transfer_group.
   */
  legs: AdjustmentLeg[];
  reason: string;
  createdBy?: string;
  createdByName?: string;
}

const label = (m: string) => PAYMENT_METHOD_LABELS[m] || m;
const money = (n: number) => `$${Math.abs(n).toLocaleString('es-AR')}`;

/** El hecho en palabras, para auditoría: "Cambio de caja: $50.000 de Efectivo a Transferencia". */
const describeAdjustment = ({ legs, reason }: CreateAdjustmentParams): string => {
  const negative = legs.find((l) => l.amount < 0);
  const positive = legs.find((l) => l.amount > 0);
  if (legs.length === 2 && negative && positive) {
    return `Cambio de caja: ${money(positive.amount)} de ${label(negative.method)} a ${label(positive.method)} — ${reason}`;
  }
  const leg = legs[0];
  const verbo = leg.amount < 0 ? 'sale de' : 'entra a';
  return `Ajuste de caja: ${money(leg.amount)} ${verbo} ${label(leg.method)} — ${reason}`;
};

export const useCreateCashAdjustment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateAdjustmentParams) => {
      const { legs, reason, createdBy, createdByName } = params;
      const transferGroup = legs.length > 1 ? crypto.randomUUID() : null;

      const { data, error } = await supabase
        .from('cash_adjustments')
        .insert(
          legs.map((l) => ({
            method: l.method,
            amount: l.amount,
            reason,
            transfer_group: transferGroup,
            created_by: createdBy || null,
            created_by_name: createdByName || null,
          }))
        )
        .select();
      if (error) throw asError(error);

      const created = (data || []).map(mapCashAdjustment);

      // El rastro se espera, como en la corrección de medio de pago: mover
      // plata de caja sin registro es justo lo que este renglón vino a evitar.
      // Que falle no voltea el ajuste —ya está a la vista en el cierre—, pero
      // quien lo hizo se tiene que enterar.
      const { ok: auditOk } = await logAuditEvent({
        entityType: 'cash_adjustment',
        entityId: created[0]?.id ?? 'sin-id',
        action: 'CREATE',
        description: describeAdjustment(params),
        newValues: Object.fromEntries(
          legs.map((l) => [label(l.method), l.amount])
        ),
        metadata: {
          motivo: reason,
          transferGroup,
          patas: legs,
        },
      });

      return { created, auditOk };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
};

interface DeleteAdjustmentParams {
  /** Todas las patas juntas: borrar media pata de un cambio deja la caja renga. */
  ids: string[];
  /** Para el rastro: qué se está deshaciendo, en palabras. */
  description: string;
}

export const useDeleteCashAdjustment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, description }: DeleteAdjustmentParams) => {
      // Con .select(): un DELETE que la política filtró vuelve sin error y sin
      // filas, y sin mirarlas el rastro contaría un borrado que no ocurrió.
      const { data, error } = await supabase
        .from('cash_adjustments')
        .delete()
        .in('id', ids)
        .select('id');
      if (error) throw asError(error);
      if (!data || data.length === 0) {
        throw new Error('El ajuste no se pudo borrar. Puede que tu rol ya no lo permita: actualizá la pantalla.');
      }

      const { ok: auditOk } = await logAuditEvent({
        entityType: 'cash_adjustment',
        entityId: ids[0],
        action: 'DELETE',
        description: `Se deshizo un ajuste de caja: ${description}`,
        metadata: { ids },
      });

      return { auditOk };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
};
