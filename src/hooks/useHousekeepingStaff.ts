import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface HousekeepingStaffMember {
    /** profiles.id — same id as auth.users, so notifications can be personal */
    id: string;
    name: string;
    email: string | null;
}

/**
 * El campo "Asignar a" es texto libre (hay personal sin usuario en la app), así
 * que la persona a notificar se resuelve comparando el nombre escrito con el de
 * los usuarios con rol limpieza.
 */
export function findStaffByName<T extends { name: string }>(
    staff: T[],
    typedName: string,
): T | undefined {
    const name = typedName.trim().toLowerCase();
    if (!name) return undefined;
    return staff.find((s) => s.name.trim().toLowerCase() === name);
}

/**
 * Everyone with the `housekeeping` role, to assign a room at check-out.
 *
 * Readable by admin and reception thanks to the "Staff read housekeeping
 * profiles" policy (migration 20260721120000).
 */
export function useHousekeepingStaff() {
    return useQuery({
        queryKey: ['housekeeping-staff'],
        queryFn: async (): Promise<HousekeepingStaffMember[]> => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('role', 'housekeeping')
                .order('full_name', { ascending: true });

            if (error) throw new Error(error.message);

            return (data || []).map((row) => ({
                id: row.id,
                name: row.full_name?.trim() || row.email || 'Sin nombre',
                email: row.email ?? null,
            }));
        },
        staleTime: 5 * 60 * 1000,
    });
}
