import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapInvoice } from '@/lib/mappers';

export const useInvoices = () => {
    return useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('*, invoice_items(*)')
                .order('issue_date', { ascending: false });

            if (error) {
                console.error('Error fetching invoices:', error);
                throw error;
            }

            return (data || []).map(mapInvoice);
        },
    });
};
