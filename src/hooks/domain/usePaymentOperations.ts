import { useCallback } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useUpdatePayment } from '@/hooks/useUpdatePayment';
import type { Payment } from '@/types/hotel';

export function usePaymentOperations() {
  const { data: payments = [], isLoading } = usePayments();
  const createPaymentMutation = useCreatePayment();
  const updatePaymentMutation = useUpdatePayment();

  const addPayment = useCallback(
    async (paymentData: Omit<Payment, 'id'>) => {
      return await createPaymentMutation.mutateAsync(paymentData);
    },
    [createPaymentMutation]
  );

  const updatePayment = useCallback(
    async (id: string, data: Partial<Payment>) => {
      await updatePaymentMutation.mutateAsync({ id, data });
    },
    [updatePaymentMutation]
  );

  return {
    payments,
    isLoading,
    addPayment,
    updatePayment,
    isCreating: createPaymentMutation.isPending,
    isUpdating: updatePaymentMutation.isPending,
  };
}
