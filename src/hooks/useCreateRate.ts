import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DiscountType } from '@/types/hotel';

interface CreateRateParams {
    roomTypeId: string;
    startDate: Date;
    endDate: Date;
    price?: number;
    label: string;
    isActive?: boolean;
    discountType?: DiscountType;
    discountPercent?: number;
    discountAmount?: number;
    minNights?: number;
    promoCode?: string;
}

export const useCreateRate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateRateParams) => {
            const { data, error } = await supabase
                .from('rates')
                .insert({
                    room_type_id: params.roomTypeId && params.roomTypeId !== 'all' ? params.roomTypeId : null,
                    start_date: params.startDate.toISOString(),
                    end_date: params.endDate.toISOString(),
                    price: params.price || 0,
                    label: params.label,
                    is_active: params.isActive ?? true,
                    discount_type: params.discountType || 'PERCENTAGE',
                    discount_percent: params.discountPercent,
                    discount_amount: params.discountAmount,
                    min_nights: params.minNights,
                    promo_code: params.promoCode,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rates'] });
        },
    });
};
