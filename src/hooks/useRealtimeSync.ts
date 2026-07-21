import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Tablas donde dos usuarios se pisan de verdad: recepción hace el check-out y
 * limpieza trabaja sobre esa misma habitación al mismo tiempo. Sin esto los
 * cambios del otro recién aparecían al cambiar de sección o volver a la
 * pestaña (staleTime de 2 minutos en rooms).
 */
const WATCHED: { table: string; queryKey: string }[] = [
    { table: 'rooms', queryKey: 'rooms' },
    { table: 'housekeeping_tasks', queryKey: 'housekeepingTasks' },
];

/** Marcar 8 habitaciones seguidas no dispara 8 refetch: se juntan en uno. */
const DEBOUNCE_MS = 400;

/**
 * Mantiene habitaciones y tareas de limpieza al día con lo que hacen los demás.
 *
 * Solo invalida la query — el refetch sale por los mismos hooks de siempre, con
 * las mismas policies de RLS. Si el websocket no conecta, todo sigue andando
 * como antes (refetch al enfocar la ventana o cambiar de sección).
 *
 * Se monta una sola vez, en MainLayout.
 */
export function useRealtimeSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const timers = new Map<string, ReturnType<typeof setTimeout>>();

        const invalidateSoon = (queryKey: string) => {
            clearTimeout(timers.get(queryKey));
            timers.set(
                queryKey,
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: [queryKey] });
                    timers.delete(queryKey);
                }, DEBOUNCE_MS)
            );
        };

        // Topic único por montaje: con un topic compartido, todos los consumidores
        // usan UNA instancia de canal y el primer unmount corta al resto.
        const channel = supabase.channel(`realtime-sync-${Math.random().toString(36).slice(2)}`);

        for (const { table, queryKey } of WATCHED) {
            channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => invalidateSoon(queryKey)
            );
        }

        channel.subscribe((status) => {
            // Sin esto, un websocket caído se ve igual que "no pasó nada":
            // la pantalla simplemente deja de actualizarse sola.
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[Realtime] Canal ${status}: las pantallas se actualizan solo al cambiar de sección.`);
            }
        });

        return () => {
            timers.forEach(clearTimeout);
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
}
