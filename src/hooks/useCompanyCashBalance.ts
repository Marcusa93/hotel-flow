import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * El saldo de la caja de la empresa: lo recaudado desde siempre menos lo gastado.
 *
 * Se pide a la base y no se suma acá, al revés que casi todo el resto de la app.
 * Es un acumulado sin recorte de fecha, y PostgREST corta las respuestas en mil
 * filas: sumándolo en el navegador, el día que el hotel pase esa marca el saldo
 * empezaría a dar de menos sin avisar. Un número silenciosamente equivocado es
 * peor que no tenerlo, y este es el que mira el dueño antes de ir a pagar.
 *
 * La función de la base rechaza a quien no es administración, así que esto solo
 * se monta en pantallas que ya son de admin.
 */
export const useCompanyCashBalance = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ['companyCashBalance'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('company_cash_balance');
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled,
    staleTime: 60 * 1000,
  });
