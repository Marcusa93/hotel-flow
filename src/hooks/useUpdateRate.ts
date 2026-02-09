import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Rate, DiscountType } from '@/types/hotel';

interface UpdateRateParams {
    id: string;
    data: Partial<Rate> & {
        discountType?: DiscountType;
        discountPercent?: number;
        discountAmount?: number;
        minNights?: number;
        promoCode?: string;
    };
}

export const useUpdateRate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: UpdateRateParams) => {
            const updates: Record<string, any> = {};

            if (data.roomTypeId !== undefined) updates.room_type_id = data.roomTypeId === 'all' ? null : data.roomTypeId;
            if (data.startDate !== undefined) updates.start_date = data.startDate.toISOString();
            if (data.endDate !== undefined) updates.end_date = data.endDate.toISOString();
            if (data.price !== undefined) updates.price = data.price;
            if (data.label !== undefined) updates.label = data.label;
            if (data.isActive !== undefined) updates.is_active = data.isActive;
            if (data.discountType !== undefined) updates.discount_type = data.discountType;
            if (data.discountPercent !== undefined) updates.discount_percent = data.discountPercent;
            if (data.discountAmount !== undefined) updates.discount_amount = data.discountAmount;
            if (data.minNights !== undefined) updates.min_nights = data.minNights;
            if (data.promoCode !== undefined) updates.promo_code = data.promoCode;

            const { error } = await supabase
                .from('rates')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rates'] });
        },
    });
};
