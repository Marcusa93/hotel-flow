
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, format } from 'date-fns';

export interface DailyRevenue {
    date: string;
    revenue: number;
}

export const useRevenueStats = (days = 7) => {
    return useQuery({
        queryKey: ['revenueStats', days],
        queryFn: async () => {
            const today = new Date();
            const startDate = subDays(today, days);

            // Fetch raw payments instead of using RPC
            const { data, error } = await supabase
                .from('payments')
                .select('amount, date, status')
                .eq('status', 'PAID')
                .gte('date', startDate.toISOString())
                .lte('date', today.toISOString());

            if (error) throw error;

            // Aggregating data client-side
            const revenueMap = new Map<string, number>();

            data?.forEach((payment: { amount: number; date: string; status: string }) => {
                const dateStr = format(new Date(payment.date), 'yyyy-MM-dd');
                const current = revenueMap.get(dateStr) || 0;
                revenueMap.set(dateStr, current + Number(payment.amount));
            });

            // Fill in missing days with 0
            const filledData: DailyRevenue[] = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = subDays(today, i);
                const dateStr = format(d, 'yyyy-MM-dd');
                filledData.push({
                    date: dateStr,
                    revenue: revenueMap.get(dateStr) || 0,
                });
            }

            return filledData;
        },
        staleTime: 60 * 1000,
    });
};
