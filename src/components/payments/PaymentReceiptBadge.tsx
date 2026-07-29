import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAttachmentsByPayment } from '@/hooks/usePaymentAttachments';
import { PaymentAttachments } from './PaymentAttachments';
import { cn } from '@/lib/utils';

interface PaymentReceiptBadgeProps {
  paymentId: string;
  /** Lo que se lee en el encabezado del diálogo: "Efectivo · $12.000". */
  paymentLabel?: string;
  className?: string;
}

/**
 * El clip que dice, en la lista de cobros, si el pago tiene respaldo. Abre el
 * comprobante sin salir de la pantalla.
 *
 * Con cero adjuntos se muestra igual, apagado: la ausencia es justo el dato que
 * hay que ver, y esconderla dejaría a la lista sin distinguir "no tiene" de
 * "todavía no miré".
 */
export function PaymentReceiptBadge({ paymentId, paymentLabel, className }: PaymentReceiptBadgeProps) {
  const [open, setOpen] = useState(false);
  const { attachments } = useAttachmentsByPayment(paymentId);
  const count = attachments.length;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={count === 0 ? 'Sin comprobante' : `Ver ${count} comprobante${count > 1 ? 's' : ''}`}
        title={count === 0 ? 'Sin comprobante adjunto' : `${count} comprobante${count > 1 ? 's' : ''}`}
        className={cn(
          'h-7 px-1.5 gap-1 font-normal',
          count === 0 ? 'text-muted-foreground/40 hover:text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400',
          className
        )}
      >
        <Paperclip className="w-3.5 h-3.5" />
        {count > 1 && <span className="text-[11px] tabular-nums">{count}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comprobantes</DialogTitle>
            <DialogDescription>
              {paymentLabel || 'Respaldo de este cobro'}
            </DialogDescription>
          </DialogHeader>
          <PaymentAttachments paymentId={paymentId} />
        </DialogContent>
      </Dialog>
    </>
  );
}
