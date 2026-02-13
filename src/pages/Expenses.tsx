import { useState, useMemo } from 'react';
import { PageHeader, TableSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useExpenses } from '@/hooks/useExpenses';
import { useDeleteExpense } from '@/hooks/useDeleteExpense';
import { NewExpenseDialog } from '@/components/expenses';
import { ExpenseType } from '@/types/hotel';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Plus,
    Receipt,
    TrendingUp,
    Calendar,
    Filter,
    ShoppingCart,
    Wrench,
    Zap,
    Package,
    Trash2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const expenseTypeLabels: Record<ExpenseType, string> = {
    PANADERIA: 'Panadería',
    SUPERMERCADO: 'Supermercado',
    VERDULERIA: 'Verdulería',
    CARNICERIA: 'Carnicería',
    BEBIDAS: 'Bebidas',
    LIMPIEZA: 'Limpieza',
    MANTENIMIENTO: 'Mantenimiento',
    SERVICIOS: 'Servicios',
    OTROS: 'Otros'
};

const expenseTypeIcons: Record<ExpenseType, string> = {
    PANADERIA: '🥐',
    SUPERMERCADO: '🛒',
    VERDULERIA: '🥬',
    CARNICERIA: '🥩',
    BEBIDAS: '🍷',
    LIMPIEZA: '🧹',
    MANTENIMIENTO: '🔧',
    SERVICIOS: '💡',
    OTROS: '📦'
};

const expenseTypeColors: Record<ExpenseType, string> = {
    PANADERIA: 'bg-amber-100 text-amber-800',
    SUPERMERCADO: 'bg-blue-100 text-blue-800',
    VERDULERIA: 'bg-green-100 text-green-800',
    CARNICERIA: 'bg-red-100 text-red-800',
    BEBIDAS: 'bg-purple-100 text-purple-800',
    LIMPIEZA: 'bg-cyan-100 text-cyan-800',
    MANTENIMIENTO: 'bg-orange-100 text-orange-800',
    SERVICIOS: 'bg-yellow-100 text-yellow-800',
    OTROS: 'bg-slate-100 text-slate-800'
};

export default function Expenses() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [filterType, setFilterType] = useState<ExpenseType | 'ALL'>('ALL');

    // Get current month dates
    const startDate = startOfMonth(new Date());
    const endDate = endOfMonth(new Date());

    const { data: expenses = [], isLoading } = useExpenses({
        startDate,
        endDate,
        expenseType: filterType === 'ALL' ? undefined : filterType
    });

    const deleteExpense = useDeleteExpense();

    const handleDelete = async (id: string) => {
        try {
            await deleteExpense.mutateAsync(id);
            toast({
                title: 'Gasto eliminado',
                description: 'El gasto se eliminó correctamente',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo eliminar el gasto',
                variant: 'destructive',
            });
        }
    };

    // Calculate monthly stats
    const stats = useMemo(() => {
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);
        const byType: Record<string, number> = {};

        expenses.forEach(e => {
            byType[e.expenseType] = (byType[e.expenseType] || 0) + e.amount;
        });

        const topCategory = Object.entries(byType)
            .sort(([, a], [, b]) => b - a)[0];

        return {
            total,
            count: expenses.length,
            topCategory: topCategory ? topCategory[0] as ExpenseType : null,
            topCategoryAmount: topCategory ? topCategory[1] : 0
        };
    }, [expenses]);

    return (
        <div className="space-y-8">
            <PageHeader
                title="Gastos"
                description="Control de gastos operativos del hotel"
                actions={
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Gasto
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-rose-100">
                                <Receipt className="w-6 h-6 text-rose-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total del Mes</p>
                                <p className="text-2xl font-bold">${stats.total.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-blue-100">
                                <ShoppingCart className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Compras</p>
                                <p className="text-2xl font-bold">{stats.count}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-emerald-100">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Mayor Categoría</p>
                                <p className="text-lg font-bold">
                                    {stats.topCategory ? (
                                        <span className="flex items-center gap-1">
                                            {expenseTypeIcons[stats.topCategory]} {expenseTypeLabels[stats.topCategory]}
                                        </span>
                                    ) : '-'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-amber-100">
                                <Calendar className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Período</p>
                                <p className="text-lg font-bold capitalize">
                                    {format(new Date(), 'MMMM yyyy', { locale: es })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            Historial de Gastos
                        </CardTitle>
                        <Select value={filterType} onValueChange={(v) => setFilterType(v as ExpenseType | 'ALL')}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Filtrar por tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos los tipos</SelectItem>
                                {Object.entries(expenseTypeLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {expenseTypeIcons[value as ExpenseType]} {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} showHeader={false} />
                    ) : expenses.length === 0 ? (
                        <div className="py-12 text-center">
                            <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No hay gastos registrados este mes</p>
                            <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Registrar primer gasto
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                        <TableCell className="font-medium">
                                            {format(expense.date, 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={expenseTypeColors[expense.expenseType]}>
                                                {expenseTypeIcons[expense.expenseType]} {expenseTypeLabels[expense.expenseType]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {expense.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ${expense.amount.toLocaleString('es-AR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. El gasto de ${expense.amount.toLocaleString('es-AR')} será eliminado permanentemente.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(expense.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <NewExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}
