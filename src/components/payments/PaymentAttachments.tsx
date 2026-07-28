import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Paperclip, FileText, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  useAttachmentsByPayment,
  useDeletePaymentAttachment,
  useReceiptUrls,
  useUploadPaymentAttachment,
} from '@/hooks/usePaymentAttachments';
import {
  RECEIPT_INPUT_ACCEPT,
  formatFileSize,
  isImageReceipt,
  validateReceiptFile,
} from '@/lib/paymentAttachments';
import { cn } from '@/lib/utils';
import type { PaymentAttachment } from '@/types/hotel';

interface PaymentAttachmentsProps {
  paymentId: string;
  className?: string;
}

/**
 * Los comprobantes de un pago ya registrado: se miran, se agrega uno que faltaba
 * y —solo el admin— se borra.
 */
export function PaymentAttachments({ paymentId, className }: PaymentAttachmentsProps) {
  const { attachments, isLoading } = useAttachmentsByPayment(paymentId);
  const { currentRole, profileName } = useAppRole();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PaymentAttachment | null>(null);

  const uploadMutation = useUploadPaymentAttachment();
  const deleteMutation = useDeletePaymentAttachment();

  const { data: urls = {}, isLoading: urlsLoading } = useReceiptUrls(
    attachments.map(a => a.storagePath)
  );

  const canUpload = currentRole === 'admin' || currentRole === 'reception';
  const canDelete = currentRole === 'admin';

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (picked.length === 0) return;

    for (const file of picked) {
      const problem = validateReceiptFile(file);
      if (problem) {
        toast({ title: 'Archivo rechazado', description: problem, variant: 'destructive' });
        continue;
      }
      try {
        await uploadMutation.mutateAsync({
          paymentId,
          file,
          uploadedBy: user?.id,
          uploadedByName: profileName || user?.email || undefined,
        });
        toast({ title: '📎 Comprobante adjuntado', description: file.name });
      } catch (error) {
        toast({
          title: 'No se pudo adjuntar',
          description: error instanceof Error ? error.message : 'Intentá de nuevo',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete);
      toast({ title: 'Comprobante eliminado', description: pendingDelete.fileName });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Intentá de nuevo',
        variant: 'destructive',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  if (isLoading) {
    return <Skeleton className={cn('h-8 w-40', className)} />;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map(attachment => {
            const url = urls[attachment.storagePath];
            const isImage = isImageReceipt(attachment.mimeType);

            return (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-lg border bg-background/60 px-2 py-1.5"
              >
                {/* La miniatura es lo que responde "¿está pagado?" de un vistazo,
                    sin abrir nada. */}
                {isImage && url ? (
                  <img
                    src={url}
                    alt={attachment.fileName}
                    loading="lazy"
                    className="h-10 w-10 rounded object-cover border shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded border flex items-center justify-center bg-muted shrink-0">
                    {isImage && urlsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {attachment.uploadedByName ? `${attachment.uploadedByName} · ` : ''}
                    {format(attachment.createdAt, "d MMM HH:mm", { locale: es })}
                    {attachment.sizeBytes ? ` · ${formatFileSize(attachment.sizeBytes)}` : ''}
                  </p>
                </div>

                {url ? (
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 shrink-0">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Ver
                    </a>
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground px-2 shrink-0">
                    {urlsLoading ? 'Abriendo…' : 'No disponible'}
                  </span>
                )}

                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(attachment)}
                    aria-label={`Eliminar ${attachment.fileName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={RECEIPT_INPUT_ACCEPT}
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Paperclip className="w-3.5 h-3.5 mr-1.5" />
            )}
            {attachments.length === 0 ? 'Adjuntar comprobante' : 'Adjuntar otro'}
          </Button>
        </>
      )}

      {!canUpload && attachments.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin comprobante adjunto</p>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={open => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el comprobante?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra "{pendingDelete?.fileName}" y no se puede recuperar. El pago queda
              registrado igual, pero sin el respaldo que lo prueba.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
