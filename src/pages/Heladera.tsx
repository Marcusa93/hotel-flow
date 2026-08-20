import { useMemo, useState } from 'react';
import { useAppRole } from '@/context/AppRoleContext';
import { PageHeader, TableSkeleton, EmptyState, KPICard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMinibarItems, useUpdateMinibarItem } from '@/hooks/useMinibarItems';
import {
    useDeleteMinibarMovement, useKnownStaffNames, useMinibarMovements,
} from '@/hooks/useMinibarMovements';
import {
    CATEGORY_LABELS, MOVEMENT_KIND_LABELS, inventoryValue, movementAmount,
    movementCost, needsRestock, staffConsumption, stockStatus, summarizeMovements,
    unitMargin,
} from '@/lib/heladera';
import type { MinibarItem, MinibarMovement } from '@/types/hotel';
import {
    CounterSaleDialog, MinibarItemDialog, StaffConsumptionDialog,
    StockMovementDialog, type StockMovementMode,
} from '@/components/heladera';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, ClipboardCheck, Coffee, Package, PackagePlus,
    Pencil, Plus, Refrigerator, ShoppingCart, Trash2, TriangleAlert, Undo2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export default function Heladera() {
    const { currentRole } = useAppRole();
    const canWrite = currentRole === 'admin' || currentRole === 'reception';

    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const from = startOfMonth(selectedMonth);
    const to = endOfMonth(selectedMonth);
    const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

    // Los dados de baja siguen visibles: su historial de consumo es real y el
    // dueño tiene que poder mirarlo aunque el producto ya no se venda.
    const { data: items = [], isLoading } = useMinibarItems({ includeInactive: true });
    const { data: movements = [], isLoading: loadingMovements } = useMinibarMovements({ from, to });
    const { data: knownNames = [] } = useKnownStaffNames();

    const updateItem = useUpdateMinibarItem();
    const deleteMovement = useDeleteMinibarMovement();

    const [itemDialog, setItemDialog] = useState<{ open: boolean; item: MinibarItem | null }>(
        { open: false, item: null },
    );
    const [saleOpen, setSaleOpen] = useState(false);
    const [staffDialog, setStaffDialog] = useState<{ open: boolean; item: MinibarItem | null }>(
        { open: false, item: null },
    );
    const [stockDialog, setStockDialog] = useState<{
        open: boolean; mode: StockMovementMode; item: MinibarItem | null;
    }>({ open: false, mode: 'COMPRA', item: null });
    const [toDeactivate, setToDeactivate] = useState<MinibarItem | null>(null);
    const [toUndo, setToUndo] = useState<MinibarMovement | null>(null);

    const activos = useMemo(() => items.filter((i) => i.isActive), [items]);
    const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

    const valor = useMemo(() => inventoryValue(activos), [activos]);
    const reponer = useMemo(() => needsRestock(activos), [activos]);
    const resumen = useMemo(() => summarizeMovements(movements), [movements]);
    const porPersona = useMemo(() => staffConsumption(movements), [movements]);

    const goToPrevMonth = () => setSelectedMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
    const goToNextMonth = () => setSelectedMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));

    const handleDeactivate = async (item: MinibarItem) => {
        try {
            await updateItem.mutateAsync({ id: item.id, isActive: !item.isActive });
            toast({
                title: item.isActive ? 'Producto dado de baja' : 'Producto reactivado',
                description: item.name,
            });
        } catch (error) {
            toast({
                title: 'No se pudo cambiar el producto',
                description: error instanceof Error ? error.message : 'Ocurrió un error.',
                variant: 'destructive',
            });
        } finally {
            setToDeactivate(null);
        }
    };

    const handleUndo = async (movement: MinibarMovement) => {
        const itemName = itemsById.get(movement.itemId)?.name ?? 'Producto';
        try {
            await deleteMovement.mutateAsync({ movement, itemName });
            toast({ title: 'Movimiento borrado', description: `Se devolvió el stock de ${itemName}.` });
        } catch (error) {
            toast({
                title: 'No se pudo borrar',
                description: error instanceof Error ? error.message : 'Ocurrió un error.',
                variant: 'destructive',
            });
        } finally {
            setToUndo(null);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Heladera"
                description="Lo que hay adentro, lo que se vende y lo que se lleva el personal."
                actions={canWrite ? (
                    <>
                        <Button variant="outline" onClick={() => setStaffDialog({ open: true, item: null })}>
                            <Coffee className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Consumo personal</span>
                            <span className="sm:hidden">Personal</span>
                        </Button>
                        <Button onClick={() => setSaleOpen(true)}>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Vender
                        </Button>
                    </>
                ) : undefined}
            />

            {/* ─── Cómo está parada la heladera ─────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KPICard
                    title="Valor en heladera"
                    value={money(valor.alCosto)}
                    subtitle={valor.sinCosto > 0
                        ? `${valor.unidades} unidades · ${valor.sinCosto} sin costo cargado`
                        : `${valor.unidades} unidades al costo`}
                    icon={<Refrigerator className="w-5 h-5" />}
                />
                <KPICard
                    title="Vendido en el mes"
                    value={money(resumen.ventaTotal)}
                    subtitle={`${resumen.ventaHuesped.unidades} a huéspedes · ${resumen.ventaMostrador.unidades} en mostrador`}
                    icon={<ShoppingCart className="w-5 h-5" />}
                    variant="success"
                />
                <KPICard
                    title="Consumo del personal"
                    value={`${resumen.consumoPersonal.unidades}`}
                    subtitle={resumen.consumoPersonal.cobrado > 0
                        ? `${money(resumen.consumoPersonal.cobrado)} a cobrar · ${money(resumen.consumoPersonal.costo)} al costo`
                        : `${money(resumen.consumoPersonal.costo)} al costo`}
                    icon={<Coffee className="w-5 h-5" />}
                />
                <KPICard
                    title="Hay que reponer"
                    value={`${reponer.length}`}
                    subtitle={reponer.length ? reponer.slice(0, 2).map((i) => i.name).join(', ') : 'Nada por ahora'}
                    icon={<PackagePlus className="w-5 h-5" />}
                    variant={reponer.length ? 'warning' : 'default'}
                />
            </div>

            {/* ─── El mes que se está mirando ───────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-36 text-center capitalize">
                        {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} disabled={isCurrentMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
                {canWrite && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setStockDialog({ open: true, mode: 'COMPRA', item: null })}>
                            <PackagePlus className="w-4 h-4 mr-2" />
                            Reponer
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setStockDialog({ open: true, mode: 'AJUSTE', item: null })}>
                            <ClipboardCheck className="w-4 h-4 mr-2" />
                            Recuento
                        </Button>
                    </div>
                )}
            </div>

            <Tabs defaultValue="productos">
                <TabsList>
                    <TabsTrigger value="productos">Productos</TabsTrigger>
                    <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                </TabsList>

                {/* ─── Productos ─────────────────────────────────────────── */}
                <TabsContent value="productos" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">
                                {activos.length} producto{activos.length === 1 ? '' : 's'} en la heladera
                            </CardTitle>
                            {canWrite && (
                                <Button size="sm" onClick={() => setItemDialog({ open: true, item: null })}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Nuevo producto
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <TableSkeleton />
                            ) : items.length === 0 ? (
                                <EmptyState
                                    icon={Refrigerator}
                                    title="La heladera está vacía"
                                    description="Cargá el primer producto con su precio y cuántos hay."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Producto</TableHead>
                                                <TableHead className="text-right">Stock</TableHead>
                                                <TableHead className="text-right">Venta</TableHead>
                                                <TableHead className="text-right hidden md:table-cell">Costo</TableHead>
                                                <TableHead className="text-right hidden lg:table-cell">Margen</TableHead>
                                                <TableHead className="text-right hidden lg:table-cell">Personal</TableHead>
                                                {canWrite && <TableHead className="w-32" />}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item) => (
                                                <ProductRow
                                                    key={item.id}
                                                    item={item}
                                                    canWrite={canWrite}
                                                    onEdit={() => setItemDialog({ open: true, item })}
                                                    onRestock={() => setStockDialog({ open: true, mode: 'COMPRA', item })}
                                                    onStaff={() => setStaffDialog({ open: true, item })}
                                                    onToggle={() => setToDeactivate(item)}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Movimientos ───────────────────────────────────────── */}
                <TabsContent value="movimientos" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">
                                Movimientos de {format(selectedMonth, 'MMMM', { locale: es })}
                            </CardTitle>
                            {canWrite && (
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setStockDialog({ open: true, mode: 'MERMA', item: null })}
                                >
                                    <TriangleAlert className="w-4 h-4 mr-2" />
                                    Merma
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {loadingMovements ? (
                                <TableSkeleton />
                            ) : movements.length === 0 ? (
                                <EmptyState
                                    icon={Package}
                                    title="Sin movimientos este mes"
                                    description="Acá aparece cada entrada y cada salida de la heladera."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Cuándo</TableHead>
                                                <TableHead>Qué pasó</TableHead>
                                                <TableHead>Producto</TableHead>
                                                <TableHead className="text-right">Cant.</TableHead>
                                                <TableHead className="text-right">Monto</TableHead>
                                                {canWrite && <TableHead className="w-12" />}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {movements.map((m) => (
                                                <MovementRow
                                                    key={m.id}
                                                    movement={m}
                                                    itemName={itemsById.get(m.itemId)?.name ?? 'Producto borrado'}
                                                    canWrite={canWrite}
                                                    onUndo={() => setToUndo(m)}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Personal ──────────────────────────────────────────── */}
                <TabsContent value="personal" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Qué se llevó cada uno en {format(selectedMonth, 'MMMM', { locale: es })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {porPersona.length === 0 ? (
                                <EmptyState
                                    icon={Coffee}
                                    title="Nadie consumió este mes"
                                    description="Cuando alguien del hotel se lleve algo, el total aparece acá."
                                />
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Quién</TableHead>
                                                    <TableHead className="text-right">Productos</TableHead>
                                                    <TableHead className="text-right">A cobrar</TableHead>
                                                    <TableHead className="text-right hidden sm:table-cell">Al costo</TableHead>
                                                    <TableHead className="text-right hidden md:table-cell">Último</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {porPersona.map((p) => (
                                                    <TableRow key={p.name}>
                                                        <TableCell className="font-medium">{p.name}</TableCell>
                                                        <TableCell className="text-right tabular-nums">{p.unidades}</TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {p.aCobrar > 0
                                                                ? money(p.aCobrar)
                                                                : <span className="text-muted-foreground">cortesía</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                                                            {money(p.costo)}
                                                        </TableCell>
                                                        <TableCell className="text-right hidden md:table-cell text-muted-foreground text-sm">
                                                            {format(p.ultimoConsumo, 'd/M', { locale: es })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {/* Que quede claro qué es y qué no es este número. */}
                                    <p className="text-xs text-muted-foreground mt-4">
                                        Esto es el registro de lo que se llevaron, no una cuenta corriente: el sistema
                                        no cobra nada ni lo descuenta de ningún lado.
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ─── Diálogos ──────────────────────────────────────────────── */}
            <MinibarItemDialog
                open={itemDialog.open}
                onOpenChange={(open) => setItemDialog({ open, item: open ? itemDialog.item : null })}
                item={itemDialog.item}
            />
            <CounterSaleDialog open={saleOpen} onOpenChange={setSaleOpen} items={activos} />
            <StaffConsumptionDialog
                open={staffDialog.open}
                onOpenChange={(open) => setStaffDialog({ open, item: open ? staffDialog.item : null })}
                items={activos}
                knownNames={knownNames}
                preselected={staffDialog.item}
            />
            <StockMovementDialog
                open={stockDialog.open}
                onOpenChange={(open) => setStockDialog((prev) => ({ ...prev, open, item: open ? prev.item : null }))}
                mode={stockDialog.mode}
                items={activos}
                preselected={stockDialog.item}
            />

            <AlertDialog open={!!toDeactivate} onOpenChange={(open) => !open && setToDeactivate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {toDeactivate?.isActive ? '¿Dar de baja el producto?' : '¿Volver a ofrecerlo?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {toDeactivate?.isActive
                                ? `${toDeactivate?.name} deja de aparecer al cargar consumos. El historial y los movimientos quedan.`
                                : `${toDeactivate?.name} vuelve a aparecer al cargar consumos.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => toDeactivate && handleDeactivate(toDeactivate)}>
                            {toDeactivate?.isActive ? 'Dar de baja' : 'Reactivar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!toUndo} onOpenChange={(open) => !open && setToUndo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar el movimiento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El stock vuelve como estaba. Si el movimiento cobró algo —a la cuenta de una
                            reserva o en la caja—, esa plata no se toca: hay que corregirla donde está.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => toUndo && handleUndo(toUndo)}>
                            Borrar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Renglones ───────────────────────────────────────────────────────

interface ProductRowProps {
    item: MinibarItem;
    canWrite: boolean;
    onEdit: () => void;
    onRestock: () => void;
    onStaff: () => void;
    onToggle: () => void;
}

function ProductRow({ item, canWrite, onEdit, onRestock, onStaff, onToggle }: ProductRowProps) {
    const estado = stockStatus(item);
    const margen = unitMargin(item);

    return (
        <TableRow className={item.isActive ? '' : 'opacity-50'}>
            <TableCell>
                <div className="flex items-center gap-2">
                    <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {CATEGORY_LABELS[item.category]}
                            {item.detail && ` · ${item.detail}`}
                        </p>
                    </div>
                    {!item.isActive && <Badge variant="outline" className="shrink-0">De baja</Badge>}
                </div>
            </TableCell>
            <TableCell className="text-right">
                <StockBadge stock={item.stock} estado={estado} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{money(item.price)}</TableCell>
            <TableCell className="text-right tabular-nums hidden md:table-cell text-muted-foreground">
                {item.cost != null ? money(item.cost) : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums hidden lg:table-cell">
                {margen == null
                    ? <span className="text-muted-foreground">—</span>
                    : <span className={margen < 0 ? 'text-destructive' : 'text-emerald-600'}>{money(margen)}</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums hidden lg:table-cell text-muted-foreground">
                {item.staffPrice != null ? money(item.staffPrice) : 'cortesía'}
            </TableCell>
            {canWrite && (
                <TableCell>
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reponer" onClick={onRestock}>
                            <PackagePlus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Consumo del personal" onClick={onStaff}>
                            <Coffee className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={onEdit}>
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={item.isActive ? 'Dar de baja' : 'Reactivar'}
                            onClick={onToggle}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </TableCell>
            )}
        </TableRow>
    );
}

function StockBadge({ stock, estado }: { stock: number; estado: ReturnType<typeof stockStatus> }) {
    if (estado === 'negativo') {
        return (
            <Badge variant="destructive" className="tabular-nums" title="Se vendió más de lo que había cargado: hacé un recuento.">
                {stock}
            </Badge>
        );
    }
    if (estado === 'sin-stock') return <Badge variant="destructive" className="tabular-nums">0</Badge>;
    if (estado === 'bajo') {
        return <Badge className="tabular-nums bg-amber-100 text-amber-800 hover:bg-amber-100">{stock}</Badge>;
    }
    return <span className="tabular-nums font-medium">{stock}</span>;
}

interface MovementRowProps {
    movement: MinibarMovement;
    itemName: string;
    canWrite: boolean;
    onUndo: () => void;
}

function MovementRow({ movement, itemName, canWrite, onUndo }: MovementRowProps) {
    const entra = movement.quantity > 0;

    // Una venta se mira por lo que entró; una reposición o una merma, por lo que
    // costó. Mostrar el precio de venta en una merma diría que el hotel perdió
    // más de lo que perdió.
    const porCosto = movement.kind === 'COMPRA' || movement.kind === 'MERMA';
    const monto = porCosto ? movementCost(movement) : movementAmount(movement);

    return (
        <TableRow>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {format(movement.createdAt, "d/M HH:mm", { locale: es })}
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <span className="text-sm">{MOVEMENT_KIND_LABELS[movement.kind]}</span>
                    {(movement.staffName || movement.notes) && (
                        <span className="text-xs text-muted-foreground truncate max-w-52">
                            {[movement.staffName, movement.notes].filter(Boolean).join(' · ')}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-sm">{itemName}</TableCell>
            <TableCell className={`text-right tabular-nums font-medium ${entra ? 'text-emerald-600' : ''}`}>
                {entra ? `+${movement.quantity}` : movement.quantity}
            </TableCell>
            <TableCell className="text-right tabular-nums">
                {monto > 0
                    ? <span title={porCosto ? 'Al costo' : undefined}>{money(monto)}</span>
                    : <span className="text-muted-foreground">—</span>}
            </TableCell>
            {canWrite && (
                <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Borrar movimiento" onClick={onUndo}>
                        <Undo2 className="w-4 h-4" />
                    </Button>
                </TableCell>
            )}
        </TableRow>
    );
}
