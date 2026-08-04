import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapBooking, mapCurrentAccountPayment, mapOtherIncome, mapPayment } from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';
import type { Booking, CurrentAccountPayment, OtherIncome, Payment } from '@/types/hotel';

/**
 * Los movimientos de un mes, pedidos por mes.
 *
 * El resto de la app trae las tablas enteras y filtra en el navegador, que para
 * la pantalla del día alcanza. Acá no: PostgREST corta en mil filas y `payments`
 * viene ordenada por fecha descendente, así que en cuanto el hotel acumule
 * historia un mes viejo llegaría vacío o a medias —y el resumen mostraría un mes
 * flojo sin decir que le faltan datos. Se pide el período y listo.
 */

export interface MonthlyMovements {
  payments: Payment[];
  otherIncome: OtherIncome[];
  accountPayments: CurrentAccountPayment[];
  /** Las reservas que tocan el mes, aunque hayan empezado antes o terminen después. */
  bookings: Booking[];
}

export const useMonthlySummary = (month: string) => {
  return useQuery<MonthlyMovements>({
    queryKey: ['monthlySummary', month],
    queryFn: async () => {
      const start = new Date(`${month}-01T00:00:00`);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(monthEnd);

      const [paymentsRes, otherRes, accountRes, bookingsRes] = await Promise.all([
        // `payments.date` es TIMESTAMPTZ: el corte va por instante, y toISOString()
        // convierte la medianoche local al momento correcto. Comparar contra el
        // día suelto correría el borde del mes unas horas.
        supabase
          .from('payments')
          .select('*')
          .gte('date', start.toISOString())
          .lt('date', nextStart.toISOString()),
        supabase.from('other_income').select('*').gte('date', startStr).lte('date', endStr),
        supabase
          .from('current_account_payments')
          .select('*')
          .gte('date', startStr)
          .lte('date', endStr),
        // Las que se cruzan con el mes, no las que empiezan en él: la que entró
        // el 30 de junio y se fue el 2 de julio le puso una noche a julio.
        // El borde es `>=` y no `>` para no perder la media estadía del día 1,
        // que entra y sale ese mismo día.
        supabase
          .from('bookings')
          .select('*')
          .gte('check_out_date', startStr)
          .lte('check_in_date', endStr),
      ]);

      for (const res of [paymentsRes, otherRes, accountRes, bookingsRes]) {
        if (res.error) throw res.error;
      }

      return {
        payments: (paymentsRes.data || []).map(mapPayment),
        otherIncome: (otherRes.data || []).map(mapOtherIncome),
        accountPayments: (accountRes.data || []).map(mapCurrentAccountPayment),
        bookings: (bookingsRes.data || []).map(mapBooking),
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};
