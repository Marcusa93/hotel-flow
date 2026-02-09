import { useState } from 'react';
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
import { ExpenseType } from '@/types/hotel';
import { Receipt, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface NewExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const expenseTypeLabels: Record<ExpenseType, string> = {
    PANADERIA: '🥐 Panadería',
    SUPERMERCADO: '🛒 Supermercado',
    VERDULERIA: '🥬 Verdulería',
    CARNICERIA: '🥩 Carnicería',
    BEBIDAS: '🍷 Bebidas',
    LIMPIEZA: '🧹 Limpieza',
    MANTENIMIENTO: '🔧 Mantenimiento',
    SERVICIOS: '💡 Servicios (Luz, Gas, Agua)',
    OTROS: '📦 Otros'
};

export function NewExpenseDialog({ open, onOpenChange }: NewExpenseDialogProps) {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [expenseType, setExpenseType] = useState<ExpenseType>('SUPERMERCADO');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const createExpense = useCreateExpense();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount || parseFloat(amount) <= 0) return;

        await createExpense.mutateAsync({
            date: new Date(date),
            expenseType,
            amount: parseFloat(amount),
            description: description || undefined
        });

        // Reset form
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setExpenseType('SUPERMERCADO');
        setAmount('');
        setDescription('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Registrar Gasto
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
                            <SelectTrigger>
                                <SelectValue />
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
                            placeholder="Detalles adicionales del gasto..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createExpense.isPending}>
                            {createExpense.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Registrar Gasto
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
