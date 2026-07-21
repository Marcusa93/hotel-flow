import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TaskPriority } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';
import { notifyRoomAssignment } from '@/lib/housekeepingNotify';
import { formatLocalDate } from '@/lib/utils';

interface CreateTaskParams {
    roomId: string;
    date?: Date;
    assignedTo?: string;
    /** profiles.id of the assignee — turns the notification into a personal one */
    assignedToUserId?: string;
    /** Only for the notification text; the task itself references the room by id */
    roomNumber?: string;
    priority?: TaskPriority;
    notes?: string;
    checkoutTriggered?: boolean;
}

export interface CreateTaskResult {
    task: { id: string };
    /** True when an existing non-DONE task was reused instead of creating one */
    deduped: boolean;
}

export const useCreateHousekeepingTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateTaskParams): Promise<CreateTaskResult> => {
            const taskDate = params.date || new Date();
            const dateStr = formatLocalDate(taskDate);

            // Check if a PENDING (non-DONE) task already exists for this room today.
            // Completed tasks don't block a new one (e.g. room got dirty again).
            const { data: existingTasks } = await supabase
                .from('housekeeping_tasks')
                .select('id')
                .eq('room_id', params.roomId)
                .eq('date', dateStr)
                .neq('status', 'DONE');

            if (existingTasks && existingTasks.length > 0) {
                // Task already pending — don't create a duplicate; escalate if checkout
                if (params.checkoutTriggered) {
                    await supabase
                        .from('housekeeping_tasks')
                        .update({
                            priority: 'CHECKOUT',
                            checkout_triggered: true,
                            notes: params.notes || 'Checkout automático',
                            // Reception may have picked someone else this time
                            ...(params.assignedTo ? { assigned_to: params.assignedTo } : {}),
                        })
                        .eq('id', existingTasks[0].id);
                }
                return { task: existingTasks[0], deduped: true };
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
            return { task: data, deduped: false };
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });

            // No CREATE audit log when we reused an existing task
            if (!result.deduped) {
                logAuditEvent({
                    entityType: 'housekeeping_task',
                    entityId: result.task.id,
                    action: 'CREATE',
                    description: `Tarea de limpieza creada (prioridad: ${variables.priority || 'NORMAL'})`,
                    newValues: { roomId: variables.roomId, priority: variables.priority || 'NORMAL', assignedTo: variables.assignedTo },
                });
            }

            // A reused task normally has nothing new to announce — except after a
            // check-out, where the room just became free and someone has to clean it.
            if (result.deduped && !variables.checkoutTriggered) return;

            const roomLabel = variables.roomNumber ? `Habitación ${variables.roomNumber}` : 'Una habitación';
            const title = variables.checkoutTriggered
                ? `${roomLabel} lista para limpiar`
                : `Nueva tarea de limpieza — ${roomLabel}`;
            const message = variables.notes
                || `Prioridad ${variables.priority || 'NORMAL'}${variables.assignedTo ? ` · ${variables.assignedTo}` : ''}`;
            const metadata = {
                taskId: result.task.id,
                roomId: variables.roomId,
                roomNumber: variables.roomNumber,
                priority: variables.priority || 'NORMAL',
                assignedTo: variables.assignedTo,
            };

            if (variables.assignedToUserId) {
                // Personal: only the assigned person sees it (plus a push to their devices)
                void notifyRoomAssignment({
                    userId: variables.assignedToUserId,
                    roomNumber: variables.roomNumber,
                    roomId: variables.roomId,
                    taskId: result.task.id,
                    reason: message,
                });
            } else {
                createNotificationIfEnabled({
                    type: 'info',
                    category: 'housekeeping',
                    title,
                    message,
                    metadata,
                });
            }
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
