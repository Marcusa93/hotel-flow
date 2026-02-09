
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Guest } from '@/types/hotel';

type CreateGuestParams = Omit<Guest, 'id' | 'createdAt'>;

export const useCreateGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (guestData: CreateGuestParams) => {
            const { data, error } = await supabase
                .from('guests')
                .insert({
                    full_name: guestData.fullName,
                    document_id: guestData.documentId,
                    phone: guestData.phone,
                    email: guestData.email,
                    notes: guestData.notes
                })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                fullName: data.full_name,
                documentId: data.document_id,
                email: data.email,
                phone: data.phone,
                notes: data.notes,
                createdAt: new Date(data.created_at)
            } as Guest;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guests'] });
        }
    });
};
