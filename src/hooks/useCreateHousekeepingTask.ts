import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TaskPriority } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import { formatLocalDate } from '@/lib/utils';

interface CreateTaskParams {
    roomId: string;
    date?: Date;
    assignedTo?: string;
    priority?: TaskPriority;
    notes?: string;
    checkoutTriggered?: boolean;
}

export const useCreateHousekeepingTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateTaskParams) => {
            const taskDate = params.date || new Date();
            const dateStr = formatLocalDate(taskDate);

            // Check if task already exists for this room today
            const { data: existingTasks } = await supabase
                .from('housekeeping_tasks')
                .select('id')
                .eq('room_id', params.roomId)
                .eq('date', dateStr);

            if (existingTasks && existingTasks.length > 0) {
                // Task already exists, update priority if checkout
                if (params.checkoutTriggered) {
                    await supabase
                        .from('housekeeping_tasks')
                        .update({
                            priority: 'CHECKOUT',
                            checkout_triggered: true,
                            notes: params.notes || 'Checkout automático'
                        })
                        .eq('id', existingTasks[0].id);
                }
                return existingTasks[0];
            }

            // Create new task
            const { data, error } = await supabase
                .from('housekeeping_tasks')
                .insert({
                    room_id: params.roomId,
                    date: dateStr,
                    status: 'TODO',
                    priority: params.priority || 'NORMAL',
                    assigned_to: params.assignedTo,
                    notes: params.notes,
                    checkout_triggered: params.checkoutTriggered || false,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
            logAuditEvent({
                entityType: 'housekeeping_task',
                entityId: data.id,
                action: 'CREATE',
                description: `Tarea de limpieza creada (prioridad: ${variables.priority || 'NORMAL'})`,
                newValues: { roomId: variables.roomId, priority: variables.priority || 'NORMAL', assignedTo: variables.assignedTo },
            });

            createNotificationIfEnabled({
                type: 'info',
                category: 'housekeeping',
                title: 'Nueva tarea de limpieza',
                message: `Tarea creada con prioridad ${variables.priority || 'NORMAL'}${variables.assignedTo ? ` asignada a ${variables.assignedTo}` : ''}`,
                metadata: { taskId: data.id, roomId: variables.roomId, priority: variables.priority || 'NORMAL' },
            });
        },
    });
};

// Helper function to call when a booking is checked out
export const createCheckoutTask = async (roomId: string, guestName?: string) => {
    const supabaseClient = supabase;
    const todayStr = formatLocalDate(new Date());

    // Check existing
    const { data: existingTasks } = await supabaseClient
        .from('housekeeping_tasks')
        .select('id')
        .eq('room_id', roomId)
        .eq('date', todayStr);

    if (existingTasks && existingTasks.length > 0) {
        // Update to checkout priority
        return await supabaseClient
            .from('housekeeping_tasks')
            .update({
                priority: 'CHECKOUT',
                checkout_triggered: true,
                notes: guestName ? `Checkout de ${guestName}` : 'Checkout automático',
            })
            .eq('id', existingTasks[0].id);
    }

    // Create new checkout task
    return await supabaseClient
        .from('housekeeping_tasks')
        .insert({
            room_id: roomId,
            date: todayStr,
            status: 'TODO',
            priority: 'CHECKOUT',
            checkout_triggered: true,
            notes: guestName ? `Checkout de ${guestName}` : 'Checkout automático',
        });
};
