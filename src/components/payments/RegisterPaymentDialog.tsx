import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Tag, Percent, Sparkles, X } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useRates } from '@/hooks/useRates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Rate } from '@/types/hotel';

const paymentSchema = z.object({
  date: z.date({ required_error: 'Fecha requerida' }),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const),
  amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
  reference: z.string().optional(),
  comment: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  pendingAmount: number;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  bookingId,
  pendingAmount
}: RegisterPaymentDialogProps) {
  const { addPayment } = usePaymentOperations();
  const { data: rates = [] } = useRates();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Rate | null>(null);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: new Date(),
      method: 'CASH',
      amount: pendingAmount > 0 ? pendingAmount : 0,
      reference: '',
      comment: '',
      status: 'PAID',
    },
  });

  // Get current active promotions with promo codes
  const availablePromos = useMemo(() => {
    const now = new Date();
    return rates.filter(rate => {
      if (!rate.isActive || !rate.promoCode) return false;
      const start = startOfDay(new Date(rate.startDate));
      const end = startOfDay(new Date(rate.endDate));
      return isWithinInterval(now, { start, end });
    });
  }, [rates]);

  // Calculate discount
  const calculateDiscount = (promo: Rate, amount: number): number => {
    if (promo.discountType === 'FIXED' && promo.discountAmount) {
      return Math.min(promo.discountAmount, amount);
    } else if (promo.discountPercent) {
      return amount * (promo.discountPercent / 100);
    }
    return 0;
  };

  const originalAmount = form.watch('amount') || 0;
  const discount = appliedPromo ? calculateDiscount(appliedPromo, originalAmount) : 0;
  const finalAmount = Math.max(0, originalAmount - discount);

  const handleApplyPromoCode = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    const matching = availablePromos.find(p => p.promoCode?.toUpperCase() === code);

    if (matching) {
      setAppliedPromo(matching);
      toast({
        title: '🎉 Código aplicado',
        description: `Promoción "${matching.label}" - ${matching.discountType === 'FIXED'
            ? `$${matching.discountAmount?.toLocaleString('es-AR')} de descuento`
            : `${matching.discountPercent}% de descuento`
          }`,
      });
    } else {
      const existsButInactive = rates.find(p => p.promoCode?.toUpperCase() === code);
      if (existsButInactive) {
        toast({
          title: 'Código expirado',
          description: 'Este código promocional ya no está vigente',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Código inválido',
          description: 'El código promocional no existe',
          variant: 'destructive',
        });
      }
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
  };

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);

    const paymentAmount = appliedPromo ? finalAmount : data.amount;
    const comment = appliedPromo
      ? `${data.comment || ''}\n[Promoción: ${appliedPromo.label} (${appliedPromo.promoCode}) - Descuento: $${discount.toLocaleString('es-AR')}]`.trim()
      : data.comment;

    try {
      await addPayment({
        bookingId,
        date: data.date,
        method: data.method,
        amount: paymentAmount,
        reference: data.reference,
        comment,
        status: data.status,
      });

      toast({
        title: '✅ Pago registrado',
        description: appliedPromo
          ? `Pago de $${paymentAmount.toLocaleString('es-AR')} (Descuento: $${discount.toLocaleString('es-AR')})`
          : `Se registró un pago de $${paymentAmount.toLocaleString('es-AR')}`,
      });

      form.reset();
      setAppliedPromo(null);
      setPromoCodeInput('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Registra un nuevo pago para esta reserva
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto original ($)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={0.01} {...field} />
                  </FormControl>
                  {pendingAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pendiente: ${pendingAmount.toLocaleString('es-AR')}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Promo Code Section */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Código promocional
              </FormLabel>

              {appliedPromo ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <div>
                      <Badge className="bg-emerald-500 text-white mr-2">
                        {appliedPromo.promoCode}
                      </Badge>
                      <span className="text-sm text-emerald-700 dark:text-emerald-300">
                        {appliedPromo.label}
                      </span>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemovePromo}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Ingresa el código"
                    value={promoCodeInput}
                    onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromoCode}
                    disabled={!promoCodeInput.trim()}
                  >
                    Aplicar
                  </Button>
                </div>
              )}
            </div>

            {/* Discount Summary */}
            {appliedPromo && discount > 0 && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto original</span>
                  <span className="line-through">${originalAmount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    Descuento ({appliedPromo.discountType === 'FIXED'
                      ? `$${appliedPromo.discountAmount?.toLocaleString('es-AR')}`
                      : `${appliedPromo.discountPercent}%`})
                  </span>
                  <span>-${discount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-emerald-200 dark:border-emerald-800">
                  <span>Total a pagar</span>
                  <span className="text-emerald-600">${finalAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}

            {/* Method */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CASH">Efectivo</SelectItem>
                      <SelectItem value="CARD">Tarjeta</SelectItem>
                      <SelectItem value="TRANSFER">Transferencia</SelectItem>
                      <SelectItem value="OTHER">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PAID">Pagado</SelectItem>
                      <SelectItem value="PENDING">Pendiente</SelectItem>
                      <SelectItem value="FAILED">Fallido</SelectItem>
                      <SelectItem value="REFUNDED">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nro. de transacción, comprobante..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comment */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observaciones..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : `Registrar $${finalAmount.toLocaleString('es-AR')}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
