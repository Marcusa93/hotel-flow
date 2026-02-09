
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Guest } from '@/types/hotel';

export const useGuests = () => {
    return useQuery({
        queryKey: ['guests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('guests')
                .select('*');

            if (error) throw error;

            return data.map((item: any) => ({
                id: item.id,
                fullName: item.full_name,
                documentId: item.document_id,
                phone: item.phone,
                email: item.email,
                notes: item.notes,
                createdAt: new Date(item.created_at || new Date())
            })) as Guest[];
        }
    });
};
