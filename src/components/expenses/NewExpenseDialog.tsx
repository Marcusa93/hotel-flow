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
import { Expense, ExpenseType } from '@/types/hotel';
import { Receipt, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

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
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();
    const isPending = createExpense.isPending || updateExpense.isPending;

    // Pre-fill form when editing
    useEffect(() => {
        if (expense) {
            setDate(format(new Date(expense.date), 'yyyy-MM-dd'));
            setExpenseType(expense.expenseType);
            setAmount(expense.amount.toString());
            setDescription(expense.description || '');
        } else {
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setExpenseType('SUPERMERCADO');
            setAmount('');
            setDescription('');
        }
    }, [expense, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) return;

        try {
            if (isEditing && expense) {
                await updateExpense.mutateAsync({
                    id: expense.id,
                    date: new Date(date),
                    expenseType,
                    amount: parseFloat(amount),
                    description: description || undefined,
                });
                toast({ title: 'Gasto actualizado', description: `${expenseTypeLabels[expenseType]} — $${parseFloat(amount).toLocaleString('es-AR')}` });
            } else {
                await createExpense.mutateAsync({
                    date: new Date(date),
                    expenseType,
                    amount: parseFloat(amount),
                    description: description || undefined,
                });
                toast({ title: 'Gasto registrado', description: `${expenseTypeLabels[expenseType]} — $${parseFloat(amount).toLocaleString('es-AR')}` });
            }

            setDate(format(new Date(), 'yyyy-MM-dd'));
            setExpenseType('SUPERMERCADO');
            setAmount('');
            setDescription('');
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
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto ($)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
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
