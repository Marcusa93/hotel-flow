import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Rate } from '@/types/hotel';

export const useRates = () => {
    return useQuery({
        queryKey: ['rates'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rates')
                .select('*')
                .order('start_date', { ascending: true });

            if (error) throw error;

            return (data || []).map(rate => ({
                id: rate.id,
                roomTypeId: rate.room_type_id,
                startDate: new Date(rate.start_date),
                endDate: new Date(rate.end_date),
                price: rate.price,
                label: rate.label,
                isActive: rate.is_active,
                discountType: rate.discount_type,
                discountPercent: rate.discount_percent,
                discountAmount: rate.discount_amount,
                minNights: rate.min_nights,
                promoCode: rate.promo_code,
            })) as Rate[];
        },
    });
};
