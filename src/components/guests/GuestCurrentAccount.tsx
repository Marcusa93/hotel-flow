import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import {
    useCurrentAccountPayments,
    useCreateCurrentAccountPayment,
} from '@/hooks/useCurrentAccount';
import { buildCurrentAccount } from '@/lib/currentAccount';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAppRole } from '@/context/AppRoleContext';
import type { Guest, SettlementMethod } from '@/types/hotel';

interface GuestCurrentAccountProps {
    guest: Guest;
}

/**
 * La cuenta corriente del huésped frecuente.
 *
 * El que viene todos los meses no paga cada estadía en el mostrador: se le carga
 * a la cuenta —cobrando la reserva con el método "Cuenta corriente"— y salda
 * cuando pasa. Acá se habilita, se ve el saldo y se cobra.
 */
export function GuestCurrentAccount({ guest }: GuestCurrentAccountProps) {
    const { bookings } = useBookingOperations();
    const { payments } = usePaymentOperations();
    const { data: accountPayments = [] } = useCurrentAccountPayments();
    const updateGuest = useUpdateGuest();
    const createPayment = useCreateCurrentAccountPayment();
    const { profileName } = useAppRole();

    const [isSettleOpen, setIsSettleOpen] = useState(false);
    const [amountText, setAmountText] = useState('');
    const [method, setMethod] = useState<SettlementMethod>('CASH');

    const account = useMemo(
        () => buildCurrentAccount({ guestId: guest.id, bookings, payments, accountPayments }),
        [guest.id, bookings, payments, accountPayments]
    );

    const enabled = guest.hasCurrentAccount === true;
    const amount = parsePesosInput(amountText).value;

    const handleToggle = async (next: boolean) => {
        // Con saldo abierto, apagarla escondería una deuda que sigue existiendo.
        if (!next && account.balance > 0) {
            toast({
                title: 'La cuenta tiene saldo',
                description: `Quedan $${account.balance.toLocaleString('es-AR')} sin pagar. Cobrá el saldo antes de deshabilitarla.`,
                variant: 'destructive',
            });
            return;
        }

        try {
            await updateGuest.mutateAsync({ id: guest.id, data: { hasCurrentAccount: next } });
            toast({
                title: next ? 'Cuenta corriente habilitada' : 'Cuenta corriente deshabilitada',
                description: next
                    ? 'Ya se le pueden cargar estadías a la cuenta.'
                    : 'Sus estadías vuelven a cobrarse en el momento.',
            });
        } catch {
            toast({ title: 'No se pudo cambiar la cuenta corriente', variant: 'destructive' });
        }
    };

    const handleSettle = async () => {
        if (amount <= 0) return;
        try {
            await createPayment.mutateAsync({
                guestId: guest.id,
                amount,
                method,
                createdBy: profileName || undefined,
                guestName: guest.fullName,
            });
            toast({
                title: 'Pago registrado',
                description: `$${amount.toLocaleString('es-AR')} a cuenta de ${guest.fullName}`,
            });
            setIsSettleOpen(false);
            setAmountText('');
            setMethod('CASH');
        } catch {
            toast({ title: 'No se pudo registrar el pago', variant: 'destructive' });
        }
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Cuenta corriente
                </h3>
                <div className="flex items-center gap-2">
                    <Label htmlFor="cc-switch" className="text-xs text-muted-foreground">
                        {enabled ? 'Habilitada' : 'Deshabilitada'}
                    </Label>
                    <Switch
                        id="cc-switch"
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={updateGuest.isPending}
                    />
                </div>
            </div>

            {!enabled ? (
                <div className="p-4 rounded-xl border bg-muted/30 text-sm text-muted-foreground">
                    Habilitala para que este huésped pueda cargar sus estadías a la cuenta y pagarlas
                    después, en vez de abonarlas en el momento.
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Saldo</span>
                            </div>
                            <span
                                className={`text-2xl font-bold tabular-nums ${account.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                            >
                                ${account.balance.toLocaleString('es-AR')}
                            </span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                            <span>Cargado: ${account.charged.toLocaleString('es-AR')}</span>
                            <span>Pagado: ${account.settled.toLocaleString('es-AR')}</span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setAmountText(account.balance > 0 ? formatPesosInput(account.balance) : '');
                            setIsSettleOpen(true);
                        }}
                        disabled={account.balance <= 0}
                    >
                        Cobrar cuenta corriente
                    </Button>

                    {(account.charges.length > 0 || account.payments.length > 0) && (
                        <div className="rounded-xl border divide-y">
                            {account.payments.slice(0, 5).map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2.5 text-sm">
                                    <div>
                                        <span className="text-emerald-600 dark:text-emerald-400">Pago</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {format(new Date(p.date), 'd MMM yyyy', { locale: es })} ·{' '}
                                            {PAYMENT_METHOD_LABELS[p.method] || p.method}
                                        </span>
                                    </div>
                                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                        −${p.amount.toLocaleString('es-AR')}
                                    </span>
                                </div>
                            ))}
                            {account.charges.slice(0, 5).map(c => (
                                <div key={c.paymentId} className="flex items-center justify-between p-2.5 text-sm">
                                    <div>
                                        <span>Estadía</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {format(new Date(c.date), 'd MMM yyyy', { locale: es })}
                                        </span>
                                    </div>
                                    <span className="tabular-nums">+${c.amount.toLocaleString('es-AR')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Cobrar cuenta corriente</DialogTitle>
                        <DialogDescription>
                            {guest.fullName} — saldo ${account.balance.toLocaleString('es-AR')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="cc-amount">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="cc-amount"
                                    inputMode="decimal"
                                    className="pl-7 tabular-nums"
                                    value={amountText}
                                    onChange={e => setAmountText(parsePesosInput(e.target.value).display)}
                                />
                            </div>
                            {amount > account.balance && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Es más que el saldo. El excedente no queda a favor: la cuenta llega a cero.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cc-method">Método</Label>
                            <Select value={method} onValueChange={v => setMethod(v as SettlementMethod)}>
                                <SelectTrigger id="cc-method">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSettleOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSettle} disabled={amount <= 0 || createPayment.isPending}>
                            {createPayment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Registrar pago
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
