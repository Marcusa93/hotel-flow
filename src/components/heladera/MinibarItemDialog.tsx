import { useEffect, useState } from 'react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateMinibarItem, useUpdateMinibarItem } from '@/hooks/useMinibarItems';
import { useCreateMinibarMovement } from '@/hooks/useMinibarMovements';
import { CATEGORY_LABELS, CATEGORY_ORDER, unitMargin } from '@/lib/heladera';
import type { MinibarCategory, MinibarItem, MinibarItemInput } from '@/types/hotel';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Refrigerator, Loader2 } from 'lucide-react';

interface MinibarItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Con producto, edita. Sin producto, da de alta. */
    item?: MinibarItem | null;
}

const pesos = (raw: string) => parsePesosInput(raw).value;

export function MinibarItemDialog({ open, onOpenChange, item }: MinibarItemDialogProps) {
    const isEditing = !!item;
    const createItem = useCreateMinibarItem();
    const updateItem = useUpdateMinibarItem();
    const createMovement = useCreateMinibarMovement();

    const [name, setName] = useState('');
    const [category, setCategory] = useState<MinibarCategory>('bebida');
    const [detail, setDetail] = useState('');
    const [price, setPrice] = useState('');
    const [cost, setCost] = useState('');
    const [staffPrice, setStaffPrice] = useState('');
    const [threshold, setThreshold] = useState('');
    // Sólo al dar de alta: la heladera ya tiene cosas adentro el día que la cargan.
    const [initialStock, setInitialStock] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(item?.name ?? '');
        setCategory(item?.category ?? 'bebida');
        setDetail(item?.detail ?? '');
        setPrice(item ? formatPesosInput(item.price) : '');
        setCost(item?.cost != null ? formatPesosInput(item.cost) : '');
        setStaffPrice(item?.staffPrice != null ? formatPesosInput(item.staffPrice) : '');
        setThreshold(item?.lowStockThreshold != null ? String(item.lowStockThreshold) : '');
        setInitialStock('');
    }, [open, item]);

    const precioVenta = pesos(price);
    const costoCompra = cost.trim() ? pesos(cost) : undefined;
    const margen = costoCompra == null ? null : unitMargin({ price: precioVenta, cost: costoCompra });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast({ title: 'Falta el nombre', description: 'Poné cómo se llama el producto.', variant: 'destructive' });
            return;
        }
        if (precioVenta <= 0) {
            toast({ title: 'Falta el precio', description: 'El precio de venta tiene que ser mayor a cero.', variant: 'destructive' });
            return;
        }

        // Vaciar un campo lo borra: mandar undefined dejaría el valor viejo, y
        // un costo cargado por error se volvería imposible de sacar.
        const campos: MinibarItemInput = {
            name: name.trim(),
            category,
            price: precioVenta,
            detail: detail.trim() || null,
            cost: costoCompra ?? null,
            // Vacío es cortesía, y es una decisión: sin precio, el personal no paga.
            staffPrice: staffPrice.trim() ? pesos(staffPrice) : null,
            lowStockThreshold: threshold.trim() ? Number(threshold) : null,
        };

        setSaving(true);
        try {
            if (isEditing && item) {
                await updateItem.mutateAsync({ id: item.id, ...campos });
                toast({ title: 'Producto actualizado', description: campos.name });
            } else {
                const nuevo = await createItem.mutateAsync(campos);
                const unidades = initialStock.trim() ? Number(initialStock) : 0;

                // La carga inicial es un ajuste, no una compra: lo que hay hoy en
                // la heladera se contó, no se acaba de comprar.
                if (unidades > 0) {
                    await createMovement.mutateAsync({
                        item: nuevo,
                        kind: 'AJUSTE',
                        quantity: unidades,
                        notes: 'Carga inicial',
                    });
                }

                toast({
                    title: 'Producto agregado',
                    description: unidades > 0 ? `${campos.name} — ${unidades} en heladera` : campos.name,
                });
            }
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'No se pudo guardar',
                description: error instanceof Error ? error.message : 'Ocurrió un error.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Refrigerator className="w-5 h-5" />
                        {isEditing ? 'Editar producto' : 'Nuevo producto'}
                    </DialogTitle>
                    <DialogDescription>
                        El costo y el precio de empleado son opcionales.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre</Label>
                            <Input
                                id="nombre"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Gaseosa lata"
                                autoFocus
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as MinibarCategory)}>
                                <SelectTrigger id="categoria" className="sm:w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_ORDER.map((c) => (
                                        <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="detalle">Detalle <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Textarea
                            id="detalle"
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            placeholder="Marca, tamaño, dónde se compra…"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <MoneyField
                            id="precio" label="Precio de venta" value={price} onChange={setPrice} required
                        />
                        <MoneyField
                            id="costo" label="Costo de compra" hint="opcional" value={cost} onChange={setCost}
                        />
                    </div>

                    {margen != null && (
                        <p className={`text-xs ${margen < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {margen < 0
                                ? `Se vende $${Math.abs(margen).toLocaleString('es-AR')} por debajo del costo.`
                                : `Ganás $${margen.toLocaleString('es-AR')} por unidad.`}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <MoneyField
                            id="precio-empleado"
                            label="Precio empleado"
                            hint="vacío = cortesía"
                            value={staffPrice}
                            onChange={setStaffPrice}
                        />
                        <div className="space-y-2">
                            <Label htmlFor="umbral">
                                Avisar cuando queden <span className="text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                                id="umbral"
                                inputMode="numeric"
                                placeholder="Ej: 3"
                                className="tabular-nums"
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="space-y-2">
                            <Label htmlFor="stock-inicial">¿Cuántos hay ahora en la heladera?</Label>
                            <Input
                                id="stock-inicial"
                                inputMode="numeric"
                                placeholder="0"
                                className="tabular-nums"
                                value={initialStock}
                                onChange={(e) => setInitialStock(e.target.value.replace(/\D/g, ''))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Queda como carga inicial. Después el stock se mueve solo con las ventas y las reposiciones.
                            </p>
                        </div>
                    )}

                    {isEditing && (
                        <p className="text-xs text-muted-foreground">
                            Hay {item?.stock} en la heladera. El stock no se edita acá: se mueve con una reposición o un recuento.
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isEditing ? 'Guardar' : 'Agregar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface MoneyFieldProps {
    id: string;
    label: string;
    hint?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}

function MoneyField({ id, label, hint, value, onChange, required }: MoneyFieldProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>
                {label}{hint && <span className="text-muted-foreground font-normal"> ({hint})</span>}
            </Label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                    $
                </span>
                <Input
                    id={id}
                    inputMode="decimal"
                    placeholder="0"
                    className="pl-7 tabular-nums"
                    value={value}
                    onChange={(e) => onChange(parsePesosInput(e.target.value).display)}
                    required={required}
                />
            </div>
        </div>
    );
}
