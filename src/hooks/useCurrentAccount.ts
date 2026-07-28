import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapCurrentAccountPayment } from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import type { CurrentAccountPayment, SettlementMethod } from '@/types/hotel';

/** Lo que los huéspedes fueron pagando de sus cuentas corrientes. */
export const useCurrentAccountPayments = () => {
  return useQuery<CurrentAccountPayment[]>({
    queryKey: ['currentAccountPayments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_account_payments')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapCurrentAccountPayment);
    },
  });
};

interface CreateCurrentAccountPaymentParams {
  guestId: string;
  amount: number;
  method: SettlementMethod;
  date?: Date;
  notes?: string;
  createdBy?: string;
  /** Solo para el aviso; no se guarda */
  guestName?: string;
}

/** El huésped viene y baja su cuenta corriente. Acá sí entra plata. */
export const useCreateCurrentAccountPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCurrentAccountPaymentParams) => {
      const { data, error } = await supabase
        .from('current_account_payments')
        .insert({
          guest_id: params.guestId,
          amount: params.amount,
          method: params.method,
          // Día calendario local: toISOString() puede correrlo al anterior.
          date: formatLocalDate(params.date || new Date()),
          notes: params.notes || null,
          created_by: params.createdBy || null,
        })
        .select()
        .single();

      if (error) throw error;

      return mapCurrentAccountPayment(data);
    },
    onSuccess: (payment, variables) => {
      queryClient.invalidateQueries({ queryKey: ['currentAccountPayments'] });

      const quien = variables.guestName || 'Huésped';
      const monto = `$${payment.amount.toLocaleString('es-AR')}`;

      createNotificationIfEnabled({
        type: 'success',
        category: 'payment',
        title: '💰 Pago de cuenta corriente',
        message: `${quien} pagó ${monto} de su cuenta corriente`,
        metadata: { guestId: payment.guestId },
      });

      logAuditEvent({
        entityType: 'guest',
        entityId: payment.guestId,
        action: 'UPDATE',
        description: `Pago de cuenta corriente: ${monto} (${payment.method})`,
        newValues: { amount: payment.amount, method: payment.method },
      });
    },
  });
};
