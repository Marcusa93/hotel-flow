import { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateMinibarMovement } from '@/hooks/useMinibarMovements';
import type { MinibarItem } from '@/types/hotel';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Loader2, PackagePlus, ClipboardCheck, TriangleAlert } from 'lucide-react';

/** Reponer, dar de baja lo perdido, o corregir contra lo que hay en la heladera. */
export type StockMovementMode = 'COMPRA' | 'MERMA' | 'AJUSTE';

const MODE_META: Record<StockMovementMode, {
    title: string;
    description: string;
    icon: typeof PackagePlus;
    action: string;
    /** Qué se pregunta: cuántos entran, cuántos se perdieron, o cuántos hay. */
    quantityLabel: string;
}> = {
    COMPRA: {
        title: 'Reponer',
        description: 'Entró mercadería a la heladera.',
        icon: PackagePlus,
        action: 'Cargar',
        quantityLabel: 'Cuántos entraron',
    },
    MERMA: {
        title: 'Merma',
        description: 'Se rompió, se venció o se perdió.',
        icon: TriangleAlert,
        action: 'Registrar',
        quantityLabel: 'Cuántos se perdieron',
    },
    AJUSTE: {
        title: 'Recuento',
        description: 'Contaron la heladera y el número no coincide.',
        icon: ClipboardCheck,
        action: 'Ajustar',
        quantityLabel: 'Cuántos hay realmente',
    },
};

interface StockMovementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: StockMovementMode;
    items: MinibarItem[];
    preselected?: MinibarItem | null;
}

export function StockMovementDialog({
    open, onOpenChange, mode, items, preselected,
}: StockMovementDialogProps) {
    const createMovement = useCreateMinibarMovement();
    const meta = MODE_META[mode];
    const Icon = meta.icon;

    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

    useEffect(() => {
        if (!open) return;
        setItemId(preselected?.id ?? '');
        setQuantity('');
        setNotes('');
        setUnitCost(preselected?.cost != null ? formatPesosInput(preselected.cost) : '');
    }, [open, preselected, mode]);

    const handleItemChange = (id: string) => {
        setItemId(id);
        const elegido = items.find((i) => i.id === id);
        setUnitCost(elegido?.cost != null ? formatPesosInput(elegido.cost) : '');
    };

    const valor = Number(quantity);
    const cantidadValida = quantity.trim() !== '' && Number.isFinite(valor) && valor >= 0;

    /**
     * El recuento pregunta cuánto hay, no cuánto cambió: contra una heladera
     * abierta nadie calcula diferencias, mira y cuenta. La diferencia la saca
     * la app.
     */
    const diferencia = mode === 'AJUSTE' && item && cantidadValida ? valor - item.stock : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!item) {
            toast({ title: 'Elegí el producto', variant: 'destructive' });
            return;
        }
        if (!cantidadValida) {
            toast({ title: 'Poné la cantidad', variant: 'destructive' });
            return;
        }

        const cantidad = mode === 'COMPRA' ? valor : mode === 'MERMA' ? -valor : diferencia;

        if (cantidad === 0) {
            if (mode === 'AJUSTE') {
                toast({
                    title: 'No hay nada que ajustar',
                    description: `El sistema ya dice ${item.stock}.`,
                });
                onOpenChange(false);
            } else {
                toast({ title: 'La cantidad tiene que ser mayor a cero', variant: 'destructive' });
            }
            return;
        }

        setSaving(true);
        try {
            await createMovement.mutateAsync({
                item,
                kind: mode,
                quantity: cantidad,
                // El costo se congela sólo en la reposición: es la única que
                // cambia lo que vale reponer. En merma y ajuste se usa el del
                // producto para poder valuar la pérdida.
                unitCost: mode === 'COMPRA' && unitCost.trim()
                    ? parsePesosInput(unitCost).value
                    : item.cost,
                notes: notes.trim() || undefined,
            });

            toast({
                title: `${meta.title} registrada`,
                description: mode === 'AJUSTE'
                    ? `${item.name}: de ${item.stock} a ${valor}`
                    : `${Math.abs(cantidad)} × ${item.name}`,
            });
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'No se pudo registrar',
                description: error instanceof Error ? error.message : 'Ocurrió un error.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const costoTotal = mode === 'COMPRA' && unitCost.trim() && cantidadValida
        ? valor * parsePesosInput(unitCost).value
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        {meta.title}
                    </DialogTitle>
                    <DialogDescription>{meta.description}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="producto-stock">Producto</Label>
                        <Select value={itemId} onValueChange={handleItemChange}>
                            <SelectTrigger id="producto-stock">
                                <SelectValue placeholder="Elegí el producto" />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name} · {i.stock} en heladera
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className={mode === 'COMPRA' ? 'grid grid-cols-2 gap-4' : ''}>
                        <div className="space-y-2">
                            <Label htmlFor="cantidad-stock">{meta.quantityLabel}</Label>
                            <Input
                                id="cantidad-stock"
                                inputMode="numeric"
                                placeholder="0"
                                className="tabular-nums"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                                required
                            />
                        </div>

                        {mode === 'COMPRA' && (
                            <div className="space-y-2">
                                <Label htmlFor="costo-unitario">
                                    Costo por unidad <span className="text-muted-foreground font-normal">(opcional)</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                                        $
                                    </span>
                                    <Input
                                        id="costo-unitario"
                                        inputMode="decimal"
                                        placeholder="0"
                                        className="pl-7 tabular-nums"
                                        value={unitCost}
                                        onChange={(e) => setUnitCost(parsePesosInput(e.target.value).display)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nota-stock">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input
                            id="nota-stock"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={mode === 'MERMA' ? 'Se vencieron…' : 'Dónde se compró…'}
                        />
                    </div>

                    {mode === 'AJUSTE' && item && cantidadValida && (
                        <p className="text-sm text-muted-foreground">
                            {diferencia === 0
                                ? `El sistema ya dice ${item.stock}: no hay nada que ajustar.`
                                : diferencia > 0
                                    ? `Aparecieron ${diferencia}: el sistema decía ${item.stock}.`
                                    : `Faltan ${Math.abs(diferencia)}: el sistema decía ${item.stock}.`}
                        </p>
                    )}

                    {costoTotal > 0 && (
                        <p className="text-sm text-muted-foreground">
                            La reposición costó <span className="font-medium text-foreground">${costoTotal.toLocaleString('es-AR')}</span>.
                            {' '}Cargalo también en Gastos si todavía no lo hiciste: acá sólo queda el costo del producto.
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {meta.action}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
