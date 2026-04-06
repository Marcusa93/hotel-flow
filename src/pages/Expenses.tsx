import { useState, useMemo } from 'react';
import { useAppRole } from '@/context/AppRoleContext';
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
    Filter,
    ShoppingCart,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Edit,
    Download,
    Croissant,
    Salad,
    Beef,
    Wine,
    Sparkles,
    Wrench,
    Zap,
    Package
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

const expenseTypeIcons: Record<ExpenseType, typeof ShoppingCart> = {
    PANADERIA: Croissant,
    SUPERMERCADO: ShoppingCart,
    VERDULERIA: Salad,
    CARNICERIA: Beef,
    BEBIDAS: Wine,
    LIMPIEZA: Sparkles,
    MANTENIMIENTO: Wrench,
    SERVICIOS: Zap,
    OTROS: Package,
};

function ExpenseIcon({ type, className = "w-4 h-4" }: { type: ExpenseType; className?: string }) {
    const Icon = expenseTypeIcons[type];
    return <Icon className={className} />;
}

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
    const { currentRole } = useAppRole();
    const canWrite = currentRole === 'admin' || currentRole === 'reception';
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<ExpenseType | 'ALL'>('ALL');
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Month navigation
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    const goToPrevMonth = () => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const goToNextMonth = () => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    const goToCurrentMonth = () => setSelectedMonth(new Date());
    const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

    const { data: expenses = [], isLoading } = useExpenses({
        startDate,
        endDate,
        expenseType: filterType === 'ALL' ? undefined : filterType
    });

    const deleteExpense = useDeleteExpense();

    const handleExportCSV = () => {
        if (expenses.length === 0) return;
        const headers = ['Fecha', 'Tipo', 'Descripción', 'Monto'];
        const rows = expenses.map(e => [
            format(e.date, 'dd/MM/yyyy'),
            expenseTypeLabels[e.expenseType],
            e.description || '',
            e.amount.toString(),
        ]);
        const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gastos_${format(selectedMonth, 'yyyy-MM')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exportado', description: `${expenses.length} gastos exportados a CSV` });
    };

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

        const avg = expenses.length > 0 ? Math.round(total / expenses.length) : 0;

        return {
            total,
            count: expenses.length,
            topCategory: topCategory ? topCategory[0] as ExpenseType : null,
            topCategoryAmount: topCategory ? topCategory[1] : 0,
            average: avg
        };
    }, [expenses]);

    return (
        <div className="space-y-8">
            <PageHeader
                title="Gastos"
                description="Control de gastos operativos del hotel"
                actions={
                    <div className="flex items-center gap-2">
                        {expenses.length > 0 && (
                            <Button variant="outline" size="sm" onClick={handleExportCSV}>
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </Button>
                        )}
                        {canWrite && (
                            <Button onClick={() => setDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Gasto
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9 rounded-xl">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-semibold capitalize min-w-[140px] text-center">
                        {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9 rounded-xl" disabled={isCurrentMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
                {!isCurrentMonth && (
                    <Button variant="ghost" size="sm" onClick={goToCurrentMonth} className="text-xs">
                        Mes actual
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card className="border-none shadow-md bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 shadow-sm">
                                <Receipt className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Total del Mes</p>
                                <p className="text-xl font-extrabold tracking-tight">${stats.total.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 shadow-sm">
                                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Compras</p>
                                <p className="text-xl font-extrabold tracking-tight">{stats.count}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 shadow-sm">
                                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Mayor Categoría</p>
                                <p className="text-base font-bold">
                                    {stats.topCategory ? (
                                        <span className="flex items-center gap-1.5">
                                            <ExpenseIcon type={stats.topCategory} className="w-4 h-4" /> {expenseTypeLabels[stats.topCategory]}
                                        </span>
                                    ) : '-'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 shadow-sm">
                                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Promedio</p>
                                <p className="text-xl font-extrabold tracking-tight">
                                    {stats.count > 0 ? `$${stats.average.toLocaleString('es-AR')}` : '-'}
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
                                        <span className="flex items-center gap-1.5"><ExpenseIcon type={value as ExpenseType} className="w-3.5 h-3.5" /> {label}</span>
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
                        <div className="overflow-x-auto -mx-6 px-6">
                        <Table className="min-w-[400px] sm:min-w-[600px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="hidden sm:table-cell">Descripción</TableHead>
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
                                                <span className="flex items-center gap-1.5"><ExpenseIcon type={expense.expenseType} className="w-3.5 h-3.5" /> {expenseTypeLabels[expense.expenseType]}</span>
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                                            {expense.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ${expense.amount.toLocaleString('es-AR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {canWrite && (
                                            <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => { setEditingExpense(expense.id); setDialogOpen(true); }}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
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
                                                            Se eliminará permanentemente el gasto de <strong>{expenseTypeLabels[expense.expenseType]}</strong> por <strong>${expense.amount.toLocaleString('es-AR')}</strong> del {format(new Date(expense.date), 'd MMM yyyy', { locale: es })}.
                                                            {expense.description && <><br /><span className="text-xs italic">"{expense.description}"</span></>}
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
                                            </div>
                                          )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <NewExpenseDialog
                open={dialogOpen}
                onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingExpense(null); }}
                expense={editingExpense ? expenses.find(e => e.id === editingExpense) : null}
            />
        </div>
    );
}
