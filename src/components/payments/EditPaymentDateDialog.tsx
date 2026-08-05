import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pencil, AlertTriangle, Lock, ArrowRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCashClosings } from '@/hooks/useCashClosings';
import { useUpdatePayment } from '@/hooks/useUpdatePayment';
import { isCurrentAccountPayment } from '@/lib/currentAccount';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
    describePaymentDateMove,
    earliestPaymentDay,
    latestPaymentDay,
    paymentDaySchema,
    readableDay,
    resolvePaymentDateMove,
    withLocalDay,
} from '@/lib/paymentDate';
import { formatLocalDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Payment } from '@/types/hotel';

interface EditPaymentDateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment;
}

/** "mar 4 ago 2026, 09:30" — con año siempre: sin él, el año mal tecleado se lee igual. */
const legible = (d: Date) => format(d, "EEE d MMM yyyy, HH:mm", { locale: es });

/** El día de hace N días, para los atajos. */
const diaAtras = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatLocalDate(d);
};

/**
 * Corregirle el día a un cobro que quedó en la caja equivocada.
 *
 * Existe para que recepción deje de usar el camino que encontró sola: marcar el
 * cobro como Reembolsado y volver a cargarlo con la fecha buena. Ese camino
 * funciona de casualidad —el reembolsado deja de contar en todos lados— pero no
 * tiene vuelta atrás, deja la reserva figurando impaga entre un paso y el otro,
 * e invita a registrar un cobro de más, que es exactamente como se infla una
 * caja sin que nadie lo note.
 *
 * Un solo campo a propósito. El monto y el método son otros daños contables, y
 * cada uno merece su propia decisión: el desglose por método ni siquiera queda
 * guardado en el cierre, así que corregirlo sería invisible para el detector de
 * cambios post-cierre.
 */
export function EditPaymentDateDialog({ open, onOpenChange, payment }: EditPaymentDateDialogProps) {
    const { data: closings = [], isLoading: isLoadingClosings, refetch } = useCashClosings();
    const updatePayment = useUpdatePayment();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Por los milisegundos y no por el objeto: `payment` se reconstruye en cada
    // refetch de la lista, y con él de dependencia el formulario se reseteaba solo
    // mientras el recepcionista estaba eligiendo el día.
    const originalMs = new Date(payment.date).getTime();
    const original = useMemo(() => new Date(originalMs), [originalMs]);
    const [day, setDay] = useState(() => formatLocalDate(original));

    // Reabrir sobre otro cobro tiene que traer el otro cobro, no el anterior.
    useEffect(() => {
        if (open) {
            setDay(formatLocalDate(new Date(originalMs)));
            setShowConfirm(false);
        }
    }, [open, originalMs]);

    const parsed = paymentDaySchema.safeParse(day);
    // El motivo del rechazo se muestra abajo del casillero y no en un toast: con
    // el botón deshabilitado el submit no llega a dispararse nunca, así que un
    // toast ahí adentro es un mensaje que el recepcionista no puede provocar.
    const errorDia = parsed.success ? null : parsed.error.errors[0]?.message ?? 'Elegí un día';
    const move = resolvePaymentDateMove({ payment, targetDay: day, closings });
    const destino = parsed.success ? withLocalDay(original, day) : null;
    // La hora solo se pierde en un caso: mover a hoy un cobro de más tarde que ahora.
    const horaRecortada =
        destino !== null &&
        (destino.getHours() !== original.getHours() || destino.getMinutes() !== original.getMinutes());

    // Un cobro a cuenta corriente no entra a ninguna caja: prometerle al
    // recepcionista que la plata cambia de día sería mentirle.
    const aCuentaCorriente = isCurrentAccountPayment(payment);
    const metodo = PAYMENT_METHOD_LABELS[payment.method] || payment.method;
    const monto = `$${payment.amount.toLocaleString('es-AR')}`;

    const puedeGuardar =
        parsed.success && move.verdict === 'LIBRE' && !isLoadingClosings && !isSubmitting;

    const ejecutar = async () => {
        if (!parsed.success || move.verdict !== 'LIBRE' || !destino) return;

        setIsSubmitting(true);
        try {
            // Con el caché frío —entrar directo a Cobros sin pasar por Cierre de
            // Caja— la lista de cierres arranca vacía y la guarda de arriba diría
            // que todo está libre. Se relee antes de tocar la plata.
            const { data: frescos } = await refetch();
            const confirmado = resolvePaymentDateMove({
                payment,
                targetDay: day,
                closings: frescos ?? closings,
            });

            if (confirmado.verdict !== 'LIBRE') {
                setShowConfirm(false);
                toast({
                    title: 'La caja de ese día ya está cerrada',
                    description: `Se cerró mientras tenías esto abierto (${confirmado.closedDays
                        .map(readableDay)
                        .join(' y ')}). Pedile a administración que la reabra.`,
                    variant: 'destructive',
                });
                return;
            }

            const { auditOk } = await updatePayment.mutateAsync({
                id: payment.id,
                data: { date: destino },
                expectedDate: original,
                audit: {
                    description: describePaymentDateMove({ move: confirmado, payment }),
                    // Días y horas como texto ya formateado: la pantalla de auditoría
                    // imprime el valor crudo del JSONB, y un Date serializado se lee
                    // "2026-08-03T03:00:00.000Z", o sea el día equivocado a las 3 AM.
                    oldValues: { fecha: readableDay(confirmado.originDay), hora: format(original, 'HH:mm') },
                    newValues: { fecha: readableDay(confirmado.targetDay), hora: format(destino, 'HH:mm') },
                    metadata: {
                        diaOrigen: confirmado.originDay,
                        diaDestino: confirmado.targetDay,
                        monto: payment.amount,
                        metodo: payment.method,
                        estado: payment.status,
                        bookingId: payment.bookingId,
                        cruzaDeMes: confirmado.crossesMonth,
                    },
                },
            });

            toast({
                title: 'Fecha corregida',
                description: aCuentaCorriente
                    ? `El cargo de ${monto} pasó al ${readableDay(confirmado.targetDay)}`
                    : `El cobro de ${monto} ahora entra en la caja del ${readableDay(confirmado.targetDay)}`,
            });

            if (!auditOk) {
                toast({
                    title: 'El cobro se movió, pero no quedó registrado',
                    description: 'No se pudo escribir el rastro en auditoría. Avisale a administración.',
                    variant: 'destructive',
                });
            }

            onOpenChange(false);
        } catch (error) {
            // Sin botón "Reintentar" a propósito. El diálogo queda abierto con su
            // propio botón, que reintenta lo que la pantalla está mostrando ahora;
            // el del toast reejecutaría el día que estaba elegido cuando falló, y
            // si el recepcionista lo corrigió en el medio movería el cobro a un día
            // distinto del que está leyendo.
            toast({
                title: 'No se pudo corregir la fecha',
                description: error instanceof Error ? error.message : 'La fecha quedó como estaba.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!parsed.success) {
            toast({
                title: 'Fecha inválida',
                description: parsed.error.errors[0]?.message ?? 'Revisá el día elegido',
                variant: 'destructive',
            });
            return;
        }
        if (move.verdict !== 'LIBRE') return;

        // Dos clics. Es la única defensa contra el día —o el año— equivocado, y el
        // segundo panel muestra el resultado, no la intención.
        if (!showConfirm) {
            setShowConfirm(true);
            return;
        }

        void ejecutar();
    };

    const atajos = [
        { label: 'Ayer', dia: diaAtras(1) },
        { label: 'Anteayer', dia: diaAtras(2) },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5" />
                        Corregir fecha del cobro
                    </DialogTitle>
                    <DialogDescription>
                        {monto} por {metodo} — cargado el {legible(original)}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="payment-day">¿De qué día es este cobro?</Label>
                        <Input
                            id="payment-day"
                            type="date"
                            value={day}
                            min={earliestPaymentDay()}
                            max={latestPaymentDay()}
                            onChange={(e) => {
                                setDay(e.target.value);
                                setShowConfirm(false);
                            }}
                            required
                        />
                        {errorDia && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">{errorDia}</p>
                        )}
                        <div className="flex gap-2">
                            {atajos.map(({ label, dia }) => (
                                <Button
                                    key={label}
                                    type="button"
                                    variant={day === dia ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setDay(dia);
                                        setShowConfirm(false);
                                    }}
                                >
                                    {label}
                                    <span className="ml-1.5 opacity-70">{readableDay(dia).slice(0, 5)}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* El resultado, no la intención: es lo único que delata el día
                        o el año equivocado antes de confirmar. */}
                    {destino && move.verdict !== 'SIN_CAMBIO' && (
                        <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-muted-foreground line-through">{legible(original)}</span>
                                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                <span className="font-semibold">{legible(destino)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {horaRecortada
                                    ? `Queda a las ${format(destino, 'HH:mm')}: la hora original todavía no pasó.`
                                    : 'La hora se conserva.'}
                            </p>
                            {aCuentaCorriente && (
                                <p className="text-xs text-muted-foreground">
                                    Es un cargo a cuenta corriente: no entra a ninguna caja, pero cambia de día
                                    en el renglón "A cuenta corriente" del cierre.
                                </p>
                            )}
                        </div>
                    )}

                    {parsed.success && move.crossesMonth && move.verdict === 'LIBRE' && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Esto cambia el resultado de dos meses. El Balance Mensual no guarda un corte
                                firmado: se recalcula entero.
                            </span>
                        </div>
                    )}

                    {parsed.success && move.verdict === 'BLOQUEADO' && (
                        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-800 dark:text-rose-200">
                            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <div className="space-y-1.5">
                                <p>
                                    La caja del <strong>{move.closedDays.map(readableDay).join(' y ')}</strong> ya
                                    está cerrada y rendida. Mover este cobro cambiaría lo que se rindió.
                                </p>
                                <p>
                                    Pedile a administración que la reabra desde Cierre de Caja y volvé a
                                    intentarlo. <strong>No marques el cobro como Reembolsado</strong> para
                                    esquivar esto: no tiene vuelta atrás y deja la reserva figurando impaga.
                                </p>
                            </div>
                        </div>
                    )}

                    {showConfirm && puedeGuardar && destino && (
                        <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                ⚠️ {monto} por {metodo} pasa del {readableDay(move.originDay)} al{' '}
                                {readableDay(move.targetDay)}
                            </p>
                        </div>
                    )}

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-full sm:w-auto"
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!puedeGuardar} className="w-full sm:w-auto">
                            {isSubmitting
                                ? 'Guardando...'
                                : !parsed.success
                                    ? 'Revisá el día'
                                    : move.verdict === 'SIN_CAMBIO'
                                        ? 'Elegí otro día'
                                        : showConfirm
                                            ? `✓ Confirmar ${readableDay(move.targetDay)}`
                                            : `Mover al ${readableDay(move.targetDay)}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
