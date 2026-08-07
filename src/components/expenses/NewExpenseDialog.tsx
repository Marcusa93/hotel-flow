import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCreateExpense } from '@/hooks/useCreateExpense';
import { useUpdateExpense } from '@/hooks/useUpdateExpense';
import { useCompanyCashBalance } from '@/hooks/useCompanyCashBalance';
import { useAppRole } from '@/context/AppRoleContext';
import { DEFAULT_CASH_SOURCE } from '@/lib/cashClosing';
import { CashSource, Expense, ExpenseType, SettlementMethod } from '@/types/hotel';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Receipt, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { formatPesosInput, parsePesosInput, parseLocalDate } from '@/lib/utils';
import { z } from 'zod';

const MAX_EXPENSE_AMOUNT = 100_000_000; // $100M ARS sanity cap

export const expenseSchema = z.object({
    // El <input type="date"> entrega "2026-08-03". Parsearlo como medianoche
    // local y no UTC: si no, en Argentina el gasto se guardaba con la fecha del
    // día anterior y no aparecía en el cierre de caja del día en que se cargó.
    date: z.string({ required_error: 'Fecha requerida' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha requerida')
        .transform(parseLocalDate)
        .refine(d => d.getTime() <= Date.now() + 60_000, 'La fecha no puede ser futura'),
    expenseType: z.enum(['PANADERIA', 'SUPERMERCADO', 'VERDULERIA', 'CARNICERIA', 'BEBIDAS', 'LIMPIEZA', 'MANTENIMIENTO', 'SERVICIOS', 'OTROS'] as const),
    amount: z.coerce.number()
        .positive('Monto debe ser mayor a 0')
        .max(MAX_EXPENSE_AMOUNT, 'Monto excede el límite permitido')
        .finite('Monto inválido'),
    description: z.string().max(500, 'Descripción demasiado larga').optional(),
    // Obligatorio de acá en adelante: sin esto la caja no cuadra. Los gastos ya
    // cargados quedan sin método y el cierre los muestra como "sin especificar".
    method: z.enum(['CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER'] as const, {
        required_error: 'Elegí con qué se pagó',
    }),
    cashSource: z.enum(['RECAUDACION', 'EMPRESA'] as const),
});

interface NewExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expense?: Expense | null; // If provided, edit mode
}

const expenseTypeLabels: Record<ExpenseType, string> = {
    PANADERIA: 'Panadería',
    SUPERMERCADO: 'Supermercado',
    VERDULERIA: 'Verdulería',
    CARNICERIA: 'Carnicería',
    BEBIDAS: 'Bebidas',
    LIMPIEZA: 'Limpieza',
    MANTENIMIENTO: 'Mantenimiento',
    SERVICIOS: 'Servicios (Luz, Gas, Agua)',
    OTROS: 'Otros'
};

export function NewExpenseDialog({ open, onOpenChange, expense }: NewExpenseDialogProps) {
    const isEditing = !!expense;
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [expenseType, setExpenseType] = useState<ExpenseType>('SUPERMERCADO');
    // Grouped text as typed ("70.000"); the numeric value is derived on submit.
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    // Efectivo por defecto: es de donde sale la mayoría de los gastos del día.
    const [method, setMethod] = useState<SettlementMethod>('CASH');
    /**
     * De qué caja sale, según quién lo esté cargando.
     *
     * Recepción no elige: sus gastos salen del cajón siempre, y sin desplegable
     * no hay forma de equivocarlo. Fue el error que rompió el cierre — con el
     * default en EMPRESA, recepción le pagaba al panadero del cajón sin tocar
     * nada, el gasto no bajaba el efectivo a rendir y el cierre daba faltante.
     *
     * Administración arranca en EMPRESA, que es lo que carga: la luz, internet,
     * el supermercado. Sale de lo acumulado del hotel y no toca la caja diaria.
     */
    const { currentRole } = useAppRole();
    const esAdmin = currentRole === 'admin';
    const [cashSource, setCashSource] = useState<CashSource>(
        esAdmin ? 'EMPRESA' : DEFAULT_CASH_SOURCE
    );

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();

    /**
     * Cuánto queda en la caja de la empresa, para avisar antes de cargar un
     * gasto más grande que todo lo acumulado — que casi siempre es un monto mal
     * tecleado.
     *
     * Solo administración: la función de la base rechaza al resto, y recepción
     * tampoco ve este desplegable.
     */
    const { data: saldoEmpresaRaw } = useCompanyCashBalance({ enabled: esAdmin });
    const saldoEmpresa = saldoEmpresaRaw ?? 0;
    const montoActual = parsePesosInput(amount).value || 0;
    // Al editar, lo ya imputado a la empresa por ESTE gasto no se cuenta dos veces.
    const yaImputado = expense && expense.cashSource === 'EMPRESA' ? expense.amount : 0;
    const alcanzaLaCajaEmpresa = saldoEmpresa + yaImputado >= montoActual;
    const isPending = createExpense.isPending || updateExpense.isPending;

    // Pre-fill form when editing
    useEffect(() => {
        if (expense) {
            setDate(format(new Date(expense.date), 'yyyy-MM-dd'));
            setExpenseType(expense.expenseType);
            setAmount(formatPesosInput(expense.amount));
            setDescription(expense.description || '');
            setMethod(expense.method ?? 'CASH');
            setCashSource(expense.cashSource ?? DEFAULT_CASH_SOURCE);
        } else {
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setExpenseType('SUPERMERCADO');
            setAmount('');
            setDescription('');
            setMethod('CASH');
            setCashSource(DEFAULT_CASH_SOURCE);
        }
    }, [expense, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = expenseSchema.safeParse({
            date,
            expenseType,
            // The field holds "70.000"; z.coerce.number() needs the plain number.
            amount: parsePesosInput(amount).value,
            description: description || undefined,
            method,
            cashSource,
        });

        if (!parsed.success) {
            const firstError = parsed.error.errors[0];
            toast({
                title: 'Datos inválidos',
                description: firstError?.message ?? 'Revisá los campos del formulario',
                variant: 'destructive',
            });
            return;
        }

        const validated = parsed.data;

        try {
            if (isEditing && expense) {
                await updateExpense.mutateAsync({
                    id: expense.id,
                    date: validated.date,
                    expenseType: validated.expenseType,
                    amount: validated.amount,
                    description: validated.description,
                    method: validated.method,
                    cashSource: validated.cashSource,
                });
                toast({ title: 'Gasto actualizado', description: `${expenseTypeLabels[validated.expenseType]} — $${validated.amount.toLocaleString('es-AR')}` });
            } else {
                await createExpense.mutateAsync({
                    date: validated.date,
                    expenseType: validated.expenseType,
                    amount: validated.amount,
                    description: validated.description,
                    method: validated.method,
                    cashSource: validated.cashSource,
                });
                toast({ title: 'Gasto registrado', description: `${expenseTypeLabels[validated.expenseType]} — $${validated.amount.toLocaleString('es-AR')}` });
            }

            setDate(format(new Date(), 'yyyy-MM-dd'));
            setExpenseType('SUPERMERCADO');
            setAmount('');
            setDescription('');
            setMethod('CASH');
            setCashSource(DEFAULT_CASH_SOURCE);
            onOpenChange(false);
        } catch {
            toast({ title: 'Error', description: 'No se pudo guardar el gasto', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        {isEditing ? 'Editar Gasto' : 'Registrar Gasto'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                                    $
                                </span>
                                <Input
                                    id="amount"
                                    inputMode="decimal"
                                    placeholder="0"
                                    className="pl-7 tabular-nums"
                                    value={amount}
                                    onChange={(e) => setAmount(parsePesosInput(e.target.value).display)}
                                    autoFocus={!isEditing}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="type">Tipo de Gasto</Label>
                        <Select value={expenseType} onValueChange={(v) => setExpenseType(v as ExpenseType)}>
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(expenseTypeLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="method">Con qué se pagó</Label>
                        <Select value={method} onValueChange={(v) => setMethod(v as SettlementMethod)}>
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* De cuál de las dos cajas salió. Solo lo elige
                        administración: los gastos de recepción salen del cajón
                        siempre, y sin desplegable no hay forma de equivocarlo.
                        Ya no depende del medio de pago: la luz se paga por
                        transferencia y sale de la caja de la empresa igual. */}
                    {esAdmin && (
                        <div className="space-y-2">
                            <Label htmlFor="cashSource">¿De qué caja salió?</Label>
                            <Select value={cashSource} onValueChange={(v) => setCashSource(v as CashSource)}>
                                <SelectTrigger id="cashSource">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* La de la empresa va primero porque es el default
                                        de administración: que el orden no sugiera otra
                                        cosa que la elegida. */}
                                    <SelectItem value="EMPRESA">Caja de la empresa (lo acumulado)</SelectItem>
                                    <SelectItem value="RECAUDACION">Recaudación del día (el cajón)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {cashSource === 'EMPRESA'
                                    ? 'Sale de lo acumulado del hotel. No toca la caja diaria y recepción no lo ve.'
                                    : 'Sale del cajón de recepción: se descuenta del efectivo a rendir del día.'}
                            </p>

                            {/* No bloquea: el saldo puede estar por debajo y el gasto
                                ser real igual. Pero un pago más grande que todo lo
                                acumulado casi siempre es un monto mal tecleado. */}
                            {cashSource === 'EMPRESA' && !alcanzaLaCajaEmpresa && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        La caja de la empresa tiene{' '}
                                        <strong>${saldoEmpresa.toLocaleString('es-AR')}</strong>
                                        {montoActual > 0 ? ` y este gasto es de $${montoActual.toLocaleString('es-AR')}` : ''}.
                                        {' '}Revisá el monto antes de guardar.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción (opcional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Detalle del gasto..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isEditing ? 'Guardar Cambios' : 'Registrar Gasto'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
