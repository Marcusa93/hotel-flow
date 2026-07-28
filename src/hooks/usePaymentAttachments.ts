import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapPaymentAttachment } from '@/lib/mappers';
import {
  RECEIPT_BUCKET,
  buildReceiptPath,
  resolveReceiptMime,
  validateReceiptFile,
} from '@/lib/paymentAttachments';
import { logAuditEvent } from './useCreateAuditLog';
import type { PaymentAttachment } from '@/types/hotel';

/** Cuánto vive la URL firmada. Una hora alcanza para mirar un comprobante y no
 *  deja un link a un CBU dando vueltas en el historial del navegador. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Todos los comprobantes. Se traen enteros como los pagos: la lista de pagos ya
 * viene completa y agrupar en memoria evita una consulta por pago abierto.
 */
export const usePaymentAttachments = () => {
  return useQuery<PaymentAttachment[]>({
    queryKey: ['paymentAttachments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_attachments')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(mapPaymentAttachment);
    },
  });
};

/** Los de un pago, ya filtrados. */
export const useAttachmentsByPayment = (paymentId: string | undefined) => {
  const { data = [], isLoading } = usePaymentAttachments();
  return {
    attachments: paymentId ? data.filter(a => a.paymentId === paymentId) : [],
    isLoading,
  };
};

interface UploadAttachmentParams {
  paymentId: string;
  file: File;
  uploadedBy?: string;
  uploadedByName?: string;
}

export const useUploadPaymentAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, file, uploadedBy, uploadedByName }: UploadAttachmentParams) => {
      const problem = validateReceiptFile(file);
      if (problem) throw new Error(problem);

      const storagePath = buildReceiptPath(paymentId, file.name);

      const { error: uploadError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(storagePath, file, {
          // Explícito: el bucket rechaza lo que no esté en su lista y el
          // navegador no siempre declara el tipo.
          contentType: resolveReceiptMime(file),
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('payment_attachments')
        .insert({
          payment_id: paymentId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: resolveReceiptMime(file),
          size_bytes: file.size,
          uploaded_by: uploadedBy || null,
          uploaded_by_name: uploadedByName || null,
        })
        .select()
        .single();

      if (error) {
        // El archivo ya está arriba y la fila no: sin esto queda un objeto que
        // nadie puede ver ni borrar, ocupando el bucket para siempre.
        await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
        throw error;
      }

      return mapPaymentAttachment(data);
    },
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['paymentAttachments'] });

      logAuditEvent({
        entityType: 'payment',
        entityId: attachment.paymentId,
        action: 'UPDATE',
        description: `Comprobante adjuntado: ${attachment.fileName}`,
        newValues: { fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      });
    },
  });
};

export const useDeletePaymentAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachment: PaymentAttachment) => {
      // La fila primero: es la que manda el permiso (solo admin). Si el borrado
      // del objeto fallara después, el comprobante ya dejó de figurar.
      const { error } = await supabase
        .from('payment_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      const { error: storageError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .remove([attachment.storagePath]);

      if (storageError) {
        console.error('Comprobante borrado de la base pero no del bucket:', storageError);
      }

      return attachment;
    },
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['paymentAttachments'] });

      logAuditEvent({
        entityType: 'payment',
        entityId: attachment.paymentId,
        action: 'DELETE',
        description: `Comprobante eliminado: ${attachment.fileName}`,
        oldValues: { fileName: attachment.fileName },
      });
    },
  });
};

/**
 * Sube los comprobantes elegidos en un diálogo de cobro, ya con el pago creado.
 *
 * Devuelve cuántos fallaron en vez de cortar: el pago ya está registrado y no se
 * deshace por una foto que no subió. El que llama avisa con ese número.
 */
export const useReceiptUploader = () => {
  const uploadMutation = useUploadPaymentAttachment();

  return async (
    paymentId: string,
    files: File[],
    uploader: { id?: string; name?: string }
  ): Promise<number> => {
    let failed = 0;
    for (const file of files) {
      try {
        await uploadMutation.mutateAsync({
          paymentId,
          file,
          uploadedBy: uploader.id,
          uploadedByName: uploader.name,
        });
      } catch (error) {
        console.error(`No se pudo subir el comprobante "${file.name}":`, error);
        failed += 1;
      }
    }
    return failed;
  };
};

/**
 * URLs firmadas para mirar los comprobantes. El bucket es privado: sin firma no
 * hay forma de mostrarlos.
 */
export const useReceiptUrls = (paths: string[]) => {
  // Ordenado y unido: el orden en que llegan las rutas no debería armar otra
  // consulta ni tirar abajo las firmas que ya se pidieron.
  const key = [...paths].sort().join('|');

  return useQuery<Record<string, string>>({
    queryKey: ['receiptUrls', key],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

      if (error) throw error;

      const urls: Record<string, string> = {};
      for (const item of data || []) {
        if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
      }
      return urls;
    },
    enabled: paths.length > 0,
    // Se refrescan antes de que venzan: una firma servida al filo del vencimiento
    // da un 400 justo cuando alguien la abre.
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
  });
};
