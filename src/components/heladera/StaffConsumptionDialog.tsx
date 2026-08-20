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
import { staffUnitPrice } from '@/lib/heladera';
import type { MinibarItem } from '@/types/hotel';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Coffee, Loader2 } from 'lucide-react';

interface StaffConsumptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: MinibarItem[];
    /** Nombres ya usados, para no partir a la misma persona en dos totales. */
    knownNames: string[];
    /** Con producto, arranca elegido: se abre desde el renglón de la tabla. */
    preselected?: MinibarItem | null;
}

/**
 * Alguien del hotel se llevó algo.
 *
 * No genera ingreso ni cuenta corriente: descuenta stock y deja el registro de
 * quién fue. Lo que el hotel haga después con ese total es decisión suya.
 */
export function StaffConsumptionDialog({
    open, onOpenChange, items, knownNames, preselected,
}: StaffConsumptionDialogProps) {
    const createMovement = useCreateMinibarMovement();

    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [staffName, setStaffName] = useState('');
    const [price, setPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

    useEffect(() => {
        if (!open) return;
        setItemId(preselected?.id ?? '');
        setQuantity('1');
        setStaffName('');
        setNotes('');
        setPrice(preselected ? precioSugerido(preselected) : '');
    }, [open, preselected]);

    // Al cambiar de producto se recalcula el precio: cada uno tiene el suyo, y
    // dejar el del anterior es la forma más fácil de cobrar de más.
    const handleItemChange = (id: string) => {
        setItemId(id);
        const elegido = items.find((i) => i.id === id);
        setPrice(elegido ? precioSugerido(elegido) : '');
    };

    const unidades = Number(quantity) || 0;
    const precioUnitario = price.trim() ? parsePesosInput(price).value : 0;
    const total = unidades * precioUnitario;
    const esCortesia = precioUnitario === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!item) {
            toast({ title: 'Elegí el producto', variant: 'destructive' });
            return;
        }
        if (unidades <= 0) {
            toast({ title: 'La cantidad tiene que ser mayor a cero', variant: 'destructive' });
            return;
        }
        if (!staffName.trim()) {
            toast({
                title: 'Falta quién lo consumió',
                description: 'Sin nombre el registro no sirve para nada.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            await createMovement.mutateAsync({
                item,
                kind: 'CONSUMO_PERSONAL',
                quantity: -unidades,
                unitPrice: precioUnitario,
                staffName: staffName.trim(),
                notes: notes.trim() || undefined,
            });

            toast({
                title: 'Consumo registrado',
                description: esCortesia
                    ? `${unidades} × ${item.name} — ${staffName.trim()} (cortesía)`
                    : `${unidades} × ${item.name} — ${staffName.trim()}: $${total.toLocaleString('es-AR')}`,
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Coffee className="w-5 h-5" />
                        Consumo del personal
                    </DialogTitle>
                    <DialogDescription>
                        Descuenta de la heladera y queda registrado a nombre de quien se lo llevó.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="producto-personal">Producto</Label>
                        <Select value={itemId} onValueChange={handleItemChange}>
                            <SelectTrigger id="producto-personal">
                                <SelectValue placeholder="Elegí el producto" />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name} {i.stock > 0 ? `· quedan ${i.stock}` : '· sin stock'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cantidad-personal">Cantidad</Label>
                            <Input
                                id="cantidad-personal"
                                inputMode="numeric"
                                className="tabular-nums"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="precio-personal">Precio por unidad</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                                    $
                                </span>
                                <Input
                                    id="precio-personal"
                                    inputMode="decimal"
                                    placeholder="0"
                                    className="pl-7 tabular-nums"
                                    value={price}
                                    onChange={(e) => setPrice(parsePesosInput(e.target.value).display)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="quien">Quién</Label>
                        <Input
                            id="quien"
                            list="personal-conocido"
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                            placeholder="Nombre"
                            autoComplete="off"
                            required
                        />
                        {/* Sugerir los nombres ya usados evita que la misma
                            persona termine partida en tres totales. */}
                        <datalist id="personal-conocido">
                            {knownNames.map((n) => <option key={n} value={n} />)}
                        </datalist>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nota-personal">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input
                            id="nota-personal"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Turno noche, se lo descuenta…"
                        />
                    </div>

                    {item && unidades > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {esCortesia ? (
                                <>
                                    Va como <span className="font-medium text-foreground">cortesía</span>: no se le cobra nada.
                                    {item.cost != null && ` Al hotel le cuesta $${(item.cost * unidades).toLocaleString('es-AR')}.`}
                                </>
                            ) : (
                                <>Queda registrado <span className="font-medium text-foreground">${total.toLocaleString('es-AR')}</span> a nombre de {staffName.trim() || 'quien lo consumió'}.</>
                            )}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Vacío cuando el producto es cortesía: así el campo dice "no se cobra". */
const precioSugerido = (item: MinibarItem): string => {
    const precio = staffUnitPrice(item);
    return precio > 0 ? formatPesosInput(precio) : '';
};
