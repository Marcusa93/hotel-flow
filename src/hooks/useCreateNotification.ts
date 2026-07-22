import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NotificationType, NotificationCategory } from './useNotifications';
import type { UserRole } from '@/types/hotel';

interface CreateNotificationParams {
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    /** If set, notification is personal (only this user sees it). */
    userId?: string;
    /** If userId is not set, broadcast to these roles. Defaults by category. */
    targetRoles?: UserRole[];
    /**
     * Además de la campanita, mandar push al teléfono.
     *
     * Opt-in y no por defecto: la mayoría de los avisos son de consulta y no
     * justifican vibrar un teléfono. Se reserva para lo que alguien necesita
     * saber sin estar mirando la app.
     */
    push?: boolean;
    /** A dónde lleva el push al tocarlo. Por defecto, la lista de notificaciones. */
    pushUrl?: string;
}

/**
 * Who needs to act on each kind of notification.
 *
 * Everything used to default to admin+reception, which meant a "Habitación 203
 * requiere limpieza" notice reached everyone except the people who clean.
 */
const CATEGORY_TARGETS: Record<NotificationCategory, UserRole[]> = {
    housekeeping: ['admin', 'housekeeping'],
    booking: ['admin', 'reception'],
    payment: ['admin', 'reception'],
    checkin: ['admin', 'reception'],
    checkout: ['admin', 'reception'],
    promotion: ['admin', 'reception'],
    system: ['admin', 'reception'],
};

export const targetRolesForCategory = (category: NotificationCategory): UserRole[] =>
    CATEGORY_TARGETS[category] ?? ['admin', 'reception'];

const buildPayload = (params: CreateNotificationParams) => ({
    type: params.type,
    category: params.category,
    title: params.title,
    message: params.message,
    metadata: params.metadata || {},
    is_read: false,
    user_id: params.userId ?? null,
    target_roles: params.userId ? null : (params.targetRoles ?? targetRolesForCategory(params.category)),
});

export const useCreateNotification = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateNotificationParams) => {
            const { data, error } = await supabase
                .from('notifications')
                .insert(buildPayload(params))
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

/**
 * Manda el push al mismo público que ve la notificación en la app: si es
 * personal, a esa persona; si es por roles, a quienes tengan esos roles.
 *
 * El push es "si llega, llega" — la fila en notifications ya quedó guardada, así
 * que un fallo acá no puede tumbar la operación que lo disparó.
 */
const sendPushForNotification = async (params: CreateNotificationParams) => {
    try {
        // Quien ejecutó la acción no necesita el push de su propia acción.
        const { data: { session } } = await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke('send-push', {
            body: {
                userId: params.userId,
                targetRoles: params.userId
                    ? undefined
                    : (params.targetRoles ?? targetRolesForCategory(params.category)),
                excludeUserId: session?.user?.id,
                title: params.title,
                body: params.message,
                url: params.pushUrl ?? '/notifications',
                tag: params.category,
            },
        });

        // invoke() no lanza con 4xx/5xx: devuelve { error }. Sin mirarlo, un push
        // rechazado era indistinguible de uno entregado.
        if (error) {
            console.warn('[Notificaciones] send-push falló:', error);
        } else if (data && data.sent === 0 && data.total > 0) {
            console.warn('[Notificaciones] ninguna suscripción recibió el push:', data);
        }
    } catch (err) {
        console.warn('[Notificaciones] No se pudo enviar el push:', err);
    }
};

/**
 * Create an in-app notification. Always creates — no external email/whatsapp sending.
 */
export const createNotificationIfEnabled = async (params: CreateNotificationParams) => {
    const { error } = await supabase
        .from('notifications')
        .insert(buildPayload(params));

    if (error) {
        console.error('Failed to create notification:', error);
        return; // Si no quedó guardada, tampoco corresponde avisar por push
    }

    if (params.push) {
        await sendPushForNotification(params);
    }
};
