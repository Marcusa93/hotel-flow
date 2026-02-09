import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TaskPriority } from '@/types/hotel';

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

            // Check if task already exists for this room today
            const todayStart = new Date(taskDate);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(taskDate);
            todayEnd.setHours(23, 59, 59, 999);

            const { data: existingTasks } = await supabase
                .from('housekeeping_tasks')
                .select('id')
                .eq('room_id', params.roomId)
                .gte('date', todayStart.toISOString())
                .lte('date', todayEnd.toISOString());

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
                    date: taskDate.toISOString(),
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
        },
    });
};

// Helper function to call when a booking is checked out
export const createCheckoutTask = async (roomId: string, guestName?: string) => {
    const supabaseClient = supabase;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Check existing
    const { data: existingTasks } = await supabaseClient
        .from('housekeeping_tasks')
        .select('id')
        .eq('room_id', roomId)
        .gte('date', todayStart.toISOString())
        .lte('date', todayEnd.toISOString());

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
            date: new Date().toISOString(),
            status: 'TODO',
            priority: 'CHECKOUT',
            checkout_triggered: true,
            notes: guestName ? `Checkout de ${guestName}` : 'Checkout automático',
        });
};
