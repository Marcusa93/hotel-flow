
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapPayment } from '@/lib/mappers';
import { Payment } from '@/types/hotel';
import { logAuditEvent, type CreateAuditLogParams } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

/**
 * El error de PostgREST, convertido en un Error de verdad.
 *
 * Sin `throwOnError` —que no está puesto— la librería devuelve un objeto plano
 * `{ message, details, hint, code }`, no una instancia de Error. Como todas las
 * pantallas muestran el mensaje con `error instanceof Error ? error.message :
 * <texto genérico>`, el mensaje real se perdía justo cuando más importa: el que
 * manda el trigger que protege una caja ya cerrada llegaba al mostrador como
 * "la fecha quedó como estaba", que no dice nada de lo que pasó.
 */
const asError = (error: unknown): Error => {
    if (error instanceof Error) return error;
    const message = (error as { message?: string } | null)?.message;
    return Object.assign(new Error(message || 'No se pudo actualizar el cobro'), error);
};

interface UpdatePaymentParams {
    id: string;
    data: Partial<Payment>;
    /**
     * La fecha que el cobro tenía cuando se abrió el diálogo.
     *
     * Solo la usa la corrección de fecha, y sirve para no pisar a otro: el
     * UPDATE de acá abajo es ciego —filtra por id y nada más—, los cobros se
     * cachean dos minutos y no viajan por realtime. Sin esto, dos recepcionistas
     * corrigiendo el mismo cobro terminan con el último ganando en silencio y
     * con dos rastros en auditoría que dicen que los dos salieron bien.
     */
    expectedDate?: Date;
    /** Reemplaza el rastro genérico cuando el que llama sabe describir mejor lo que hizo. */
    audit?: Pick<CreateAuditLogParams, 'description' | 'oldValues' | 'newValues' | 'metadata'>;
}

export const useUpdatePayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data, expectedDate, audit }: UpdatePaymentParams) => {
            if (expectedDate) {
                const { data: row, error: readError } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (readError) throw asError(readError);

                // Se relee y se compara en memoria en vez de filtrar el UPDATE por
                // fecha: la columna es TIMESTAMPTZ con microsegundos y el viaje por
                // Date los trunca a milisegundos, así que el filtro no matchearía
                // nunca.
                if (mapPayment(row).date.getTime() !== expectedDate.getTime()) {
                    throw new Error(
                        'Alguien más cambió la fecha de este cobro mientras lo tenías abierto. Actualizá la pantalla y fijate cómo quedó.'
                    );
                }
            }

            // Map camelCase to snake_case for DB
            const updates: Record<string, string | number | null> = {};
            if (data.amount !== undefined) updates.amount = data.amount;
            if (data.method !== undefined) updates.method = data.method;
            if (data.status !== undefined) updates.status = data.status;
            if (data.date !== undefined) updates.date = data.date instanceof Date ? data.date.toISOString() : data.date;

            // Con .select() y no a secas: un UPDATE que no matchea ninguna fila
            // —porque la política de la base lo filtró, por ejemplo si al usuario
            // le cambiaron el rol mientras tenía la pantalla abierta— vuelve sin
            // error. Sin mirar las filas afectadas, el rastro de auditoría y la
            // campanita salían igual, contando un movimiento de plata que nunca
            // ocurrió.
            const { data: updated, error } = await supabase
                .from('payments')
                .update(updates)
                .eq('id', id)
                .select('id');

            if (error) throw asError(error);
            if (!updated || updated.length === 0) {
                throw new Error('El cobro no se pudo modificar. Puede que tu rol ya no lo permita: actualizá la pantalla.');
            }

            // El rastro se espera y no se dispara al pasar. Corregir una fecha mueve
            // plata de una caja a otra, y ahí el registro de quién lo hizo no es un
            // adorno: es lo único que queda para explicar por qué un día dio
            // distinto. Que falle no voltea la corrección —la plata ya se movió—,
            // pero quien la hizo se tiene que enterar.
            const { ok: auditOk } = await logAuditEvent({
                entityType: 'payment',
                entityId: id,
                action: 'UPDATE',
                description: `Pago actualizado${data.status ? `: estado → ${data.status}` : ''}`,
                newValues: data,
                ...audit,
            });

            return { auditOk };
        },
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['revenueStats'] });
            // Un cobro que cambia de mes cambia dos balances mensuales, y esa query
            // recorta por rango de fechas en el servidor: sin invalidarla, Balance
            // Mensual sigue mostrando el número viejo hasta que vence el caché.
            queryClient.invalidateQueries({ queryKey: ['monthlySummary'] });
            // logAuditEvent no invalida nada: la escribe el helper suelto, no el hook.
            queryClient.invalidateQueries({ queryKey: ['auditLogs'] });

            if (variables.data.status) {
                // Keys must match PaymentStatus ('PENDING' | 'PAID' | 'FAILED' | 'REFUNDED')
                const typeMap: Record<string, { type: 'success' | 'warning' | 'error'; title: string }> = {
                    PAID: { type: 'success', title: 'Pago completado' },
                    REFUNDED: { type: 'warning', title: 'Pago reembolsado' },
                    FAILED: { type: 'error', title: 'Pago fallido' },
                };
                const info = typeMap[variables.data.status];
                if (info) {
                    createNotificationIfEnabled({
                        type: info.type,
                        category: 'payment',
                        title: info.title,
                        message: `Pago ${variables.id.slice(0, 8)} → ${variables.data.status}`,
                        metadata: { paymentId: variables.id, status: variables.data.status },
                    });
                }
            }

            // La corrección de fecha avisa porque el rastro de auditoría lo lee
            // administración y auditoría, no recepción: sin la campanita, el que
            // cobró de verdad ese día nunca se entera de que le movieron el cobro.
            if (variables.data.date) {
                createNotificationIfEnabled({
                    type: 'warning',
                    category: 'payment',
                    title: 'Fecha de cobro corregida',
                    message: variables.audit?.description ?? 'Se corrigió la fecha de un cobro',
                    metadata: { paymentId: variables.id, ...variables.audit?.metadata },
                });
            }
        }
    });
};
