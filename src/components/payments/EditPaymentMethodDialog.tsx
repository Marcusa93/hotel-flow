import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, AlertTriangle, Lock, ArrowRight, Banknote } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCashClosings } from '@/hooks/useCashClosings';
import { useCashSessions } from '@/hooks/useCashSessions';
import { useUpdatePayment } from '@/hooks/useUpdatePayment';
import {
    CORRECTABLE_PAYMENT_METHODS,
    describePaymentMethodChange,
    methodLabel,
    paymentMethodSchema,
    resolvePaymentMethodChange,
} from '@/lib/paymentMethod';
import { readableDay } from '@/lib/paymentDate';
import { toast } from '@/hooks/use-toast';
import type { Payment, SettlementMethod } from '@/types/hotel';

interface EditPaymentMethodDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment;
}

/** "mar 4 ago 2026, 09:30" — con año siempre, igual que en la corrección de fecha. */
const legible = (d: Date) => format(d, "EEE d MMM yyyy, HH:mm", { locale: es });

/**
 * Corregirle el medio de pago a un cobro que quedó cargado con el que no era.
 *
 * El huésped pagó en efectivo y recepción tocó QR. Sin esto la única salida es la
 * que recepción encontró sola para la fecha: marcar el cobro como Reembolsado y
 * volver a cargarlo. Ese camino no tiene vuelta atrás, deja la reserva figurando
 * impaga en el medio, e invita a registrar un cobro de más.
 *
 * Un solo campo, igual que su hermano de fecha. El monto sigue siendo otro daño
 * contable y merece su propia decisión: corregirlo cambia lo que la reserva debe,
 * no solo en qué renglón del cierre está la plata.
 *
 * Las reglas viven en `paymentMethod.ts`, no acá.
 */
export function EditPaymentMethodDialog({ open, onOpenChange, payment }: EditPaymentMethodDialogProps) {
    const { data: closings = [], isLoading: isLoadingClosings, refetch } = useCashClosings();
    // Los turnos también: un cobro dentro de un turno cerrado está tan rendido
    // como uno de un día firmado del sistema viejo.
    const {
        data: sessions = [],
        isLoading: isLoadingSessions,
        refetch: refetchSessions,
    } = useCashSessions();
    const updatePayment = useUpdatePayment();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Por el valor y no por el objeto: `payment` se reconstruye en cada refetch de
    // la lista, y con él de dependencia el desplegable se reseteaba solo mientras
    // el recepcionista estaba eligiendo.
    const metodoOriginal = payment.method;
    const [method, setMethod] = useState<SettlementMethod>(
        // Arranca en el que tiene, si es corregible. Con un cargo a cuenta
        // corriente arranca en efectivo, pero el veredicto bloquea igual: el
        // desplegable ni se muestra.
        () => (CORRECTABLE_PAYMENT_METHODS as string[]).includes(metodoOriginal)
            ? (metodoOriginal as SettlementMethod)
            : 'CASH'
    );

    // Reabrir sobre otro cobro tiene que traer el otro cobro, no el anterior.
    useEffect(() => {
        if (open) {
            setMethod(
                (CORRECTABLE_PAYMENT_METHODS as string[]).includes(metodoOriginal)
                    ? (metodoOriginal as SettlementMethod)
                    : 'CASH'
            );
            setShowConfirm(false);
        }
    }, [open, metodoOriginal]);

    const parsed = paymentMethodSchema.safeParse(method);
    const change = resolvePaymentMethodChange({ payment, targetMethod: method, closings, sessions });
    const cuando = new Date(payment.date);
    const monto = `$${payment.amount.toLocaleString('es-AR')}`;

    const puedeGuardar =
        parsed.success &&
        change.verdict === 'LIBRE' &&
        !isLoadingClosings &&
        !isLoadingSessions &&
        !isSubmitting;

    const ejecutar = async () => {
        if (!parsed.success || change.verdict !== 'LIBRE') return;

        setIsSubmitting(true);
        try {
            // Con el caché frío —entrar directo a Cobros sin pasar por Cierre de
            // Caja— la lista de cierres arranca vacía y la guarda de arriba diría
            // que todo está libre. Se relee antes de tocar la plata.
            const [{ data: frescos }, { data: turnosFrescos }] = await Promise.all([
                refetch(),
                refetchSessions(),
            ]);
            const confirmado = resolvePaymentMethodChange({
                payment,
                targetMethod: method,
                closings: frescos ?? closings,
                sessions: turnosFrescos ?? sessions,
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
                data: { method },
                expectedMethod: metodoOriginal,
                audit: {
                    description: describePaymentMethodChange({ change: confirmado, payment }),
                    // Etiquetas y no códigos: la pantalla de auditoría imprime el
                    // valor crudo del JSONB, y "QR"/"CASH" ahí adentro obliga a
                    // traducir de memoria justo cuando se está buscando por qué una
                    // caja dio distinto.
                    oldValues: { metodo: methodLabel(confirmado.originMethod) },
                    newValues: { metodo: methodLabel(confirmado.targetMethod) },
                    metadata: {
                        dia: confirmado.day,
                        metodoOrigen: confirmado.originMethod,
                        metodoDestino: confirmado.targetMethod,
                        monto: payment.amount,
                        estado: payment.status,
                        bookingId: payment.bookingId,
                        mueveEfectivo: confirmado.movesCash,
                        mueveCheque: confirmado.movesCheque,
                    },
                },
            });

            toast({
                title: 'Medio de pago corregido',
                description: confirmado.movesCash
                    ? `${monto} ${confirmado.targetMethod === 'CASH' ? 'entra' : 'sale'} del efectivo del ${readableDay(confirmado.day)}: volvé a contar el cajón.`
                    : `${monto} ahora figura como ${methodLabel(confirmado.targetMethod)}`,
            });

            if (!auditOk) {
                toast({
                    title: 'El cobro se corrigió, pero no quedó registrado',
                    description: 'No se pudo escribir el rastro en auditoría. Avisale a administración.',
                    variant: 'destructive',
                });
            }

            onOpenChange(false);
        } catch (error) {
            // Sin botón "Reintentar" a propósito, por lo mismo que en la corrección
            // de fecha: el diálogo queda abierto con su propio botón, que reintenta
            // lo que la pantalla está mostrando ahora.
            toast({
                title: 'No se pudo corregir el medio de pago',
                description: error instanceof Error ? error.message : 'El cobro quedó como estaba.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!parsed.success || change.verdict !== 'LIBRE') return;

        // Dos clics, igual que la fecha: el segundo panel muestra el resultado, no
        // la intención.
        if (!showConfirm) {
            setShowConfirm(true);
            return;
        }

        void ejecutar();
    };

    const esCuentaCorriente = change.verdict === 'CUENTA_CORRIENTE';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Corregir medio de pago
                    </DialogTitle>
                    <DialogDescription>
                        {monto} — cobrado el {legible(cuando)} como {methodLabel(metodoOriginal)}
                    </DialogDescription>
                </DialogHeader>

                {/* Un cargo a cuenta corriente no tiene medio de pago que corregir:
                    no entró plata. Se explica y se ofrece la salida real en vez de
                    mostrar un desplegable que promete algo que no va a pasar. */}
                {esCuentaCorriente ? (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 p-3 text-xs text-slate-700 dark:text-slate-300">
                            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <div className="space-y-1.5">
                                <p>
                                    Este cargo quedó anotado en la cuenta del huésped:{' '}
                                    <strong>no entró plata a ninguna caja</strong>, así que no hay medio de pago
                                    que corregir.
                                </p>
                                <p>
                                    Si el huésped vino a pagar lo que debe, registralo desde su cuenta corriente.
                                    Y si el cargo estaba mal desde el principio, eso lo resuelve administración.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                Entendido
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="payment-method">¿Cómo se pagó realmente?</Label>
                            <Select
                                value={method}
                                onValueChange={(v) => {
                                    setMethod(v as SettlementMethod);
                                    setShowConfirm(false);
                                }}
                            >
                                <SelectTrigger id="payment-method">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CORRECTABLE_PAYMENT_METHODS.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {methodLabel(m)}
                                            {m === metodoOriginal && (
                                                <span className="ml-2 text-xs text-muted-foreground">— el que tiene</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                El cobro se queda en la caja del {readableDay(change.day)}: esto cambia con qué se
                                pagó, no de qué día es.
                            </p>
                        </div>

                        {/* El resultado, no la intención: es lo que delata el método
                            equivocado antes de confirmar. */}
                        {change.verdict === 'LIBRE' && (
                            <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="text-muted-foreground line-through">
                                        {methodLabel(change.originMethod)}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                    <span className="font-semibold">{methodLabel(change.targetMethod)}</span>
                                </div>
                                {!change.movesCash && !change.movesCheque && (
                                    <p className="text-xs text-muted-foreground">
                                        El efectivo a rendir no cambia: ni antes ni después es plata del cajón.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* El aviso que más importa: es el único cambio de método que
                            mueve la plata que se cuenta a mano al cerrar. */}
                        {change.verdict === 'LIBRE' && change.movesCash && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                                <Banknote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                    {change.targetMethod === 'CASH' ? (
                                        <>
                                            El efectivo a rendir del {readableDay(change.day)} <strong>sube {monto}</strong>:
                                            esa plata tiene que estar en el cajón.
                                        </>
                                    ) : (
                                        <>
                                            El efectivo a rendir del {readableDay(change.day)} <strong>baja {monto}</strong>:
                                            si esa plata está en el cajón, el cierre va a dar sobrante.
                                        </>
                                    )}
                                </span>
                            </div>
                        )}

                        {change.verdict === 'LIBRE' && change.movesCheque && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                    {change.targetMethod === 'CHEQUE'
                                        ? 'El cierre va a pedir un cheque de este monto: tiene que estar el papel en el mostrador.'
                                        : 'Deja de figurar como cheque, así que el cierre ya no va a pedir ese papel.'}
                                </span>
                            </div>
                        )}

                        {change.verdict === 'BLOQUEADO' && (
                            <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-800 dark:text-rose-200">
                                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <div className="space-y-1.5">
                                    <p>
                                        La caja del <strong>{change.closedDays.map(readableDay).join(' y ')}</strong> ya
                                        está cerrada y rendida. El desglose por método no queda guardado en el
                                        cierre, así que cambiarlo ahora reescribiría lo que se rindió sin dejar
                                        rastro en los números.
                                    </p>
                                    <p>
                                        Pedile a administración que la reabra desde Cierre de Caja y volvé a
                                        intentarlo. <strong>No marques el cobro como Reembolsado</strong> para
                                        esquivar esto: no tiene vuelta atrás y deja la reserva figurando impaga.
                                    </p>
                                </div>
                            </div>
                        )}

                        {showConfirm && puedeGuardar && (
                            <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    ⚠️ {monto} del {readableDay(change.day)} pasa de{' '}
                                    {methodLabel(change.originMethod)} a {methodLabel(change.targetMethod)}
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
                                    : change.verdict === 'SIN_CAMBIO'
                                        ? 'Elegí otro medio de pago'
                                        : showConfirm
                                            ? `✓ Confirmar ${methodLabel(change.targetMethod)}`
                                            : `Cambiar a ${methodLabel(change.targetMethod)}`}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
