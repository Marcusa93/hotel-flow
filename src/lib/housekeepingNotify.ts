import { createNotificationIfEnabled } from '@/hooks/useCreateNotification';

interface RoomAssignmentParams {
    /** profiles.id de la persona de limpieza — la notificación es solo para ella */
    userId: string;
    roomNumber?: string;
    roomId?: string;
    taskId?: string;
    /** Contexto: "Check-out de Pérez", "Prioridad urgente", etc. */
    reason?: string;
}

/**
 * Avisa a una persona de limpieza que tiene una habitación asignada.
 *
 * Se usa tanto en el check-out como al asignar una tarea ya existente desde
 * Limpieza, para que el aviso sea siempre el mismo: notificación personal en la
 * app + push al teléfono.
 */
export async function notifyRoomAssignment({
    userId,
    roomNumber,
    roomId,
    taskId,
    reason,
}: RoomAssignmentParams) {
    const roomLabel = roomNumber ? `Habitación ${roomNumber}` : 'Una habitación';
    const title = `${roomLabel} para limpiar`;
    const message = reason || 'Te asignaron esta habitación';

    await createNotificationIfEnabled({
        type: 'info',
        category: 'housekeeping',
        title,
        message,
        userId,
        metadata: { taskId, roomId, roomNumber },
        push: true,
        pushUrl: '/housekeeping',
    });
}
