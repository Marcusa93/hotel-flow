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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    CounterSaleMethod, StockNoDescontadoError, useCounterSale,
} from '@/hooks/useMinibarMovements';
import { CATEGORY_LABELS, CATEGORY_ORDER, stockStatus } from '@/lib/heladera';
import type { MinibarItem } from '@/types/hotel';
import { toast } from '@/hooks/use-toast';
import { Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';

/** El cheque no está: other_income no lo acepta y nadie paga una lata así. */
const METODOS: { value: CounterSaleMethod; label: string }[] = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'DEBIT', label: 'T. Débito' },
    { value: 'CREDIT', label: 'T. Crédito' },
    { value: 'QR', label: 'QR' },
    { value: 'OTHER', label: 'Otro' },
];

interface CounterSaleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: MinibarItem[];
}

/**
 * Se vendió algo cobrando en el momento.
 *
 * Lo que sale de acá es un ingreso externo, que es lo que el cierre de caja ya
 * mira. Sin eso, el efectivo aparece en el cajón sin renglón que lo explique.
 */
export function CounterSaleDialog({ open, onOpenChange, items }: CounterSaleDialogProps) {
    const counterSale = useCounterSale();
    const [cart, setCart] = useState<Map<string, number>>(new Map());
    const [method, setMethod] = useState<CounterSaleMethod>('CASH');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCart(new Map());
        setMethod('CASH');
        setNotes('');
    }, [open]);

    const updateQty = (itemId: string, delta: number) => {
        setCart((prev) => {
            const next = new Map(prev);
            const qty = (next.get(itemId) || 0) + delta;
            if (qty <= 0) next.delete(itemId);
            else next.set(itemId, qty);
            return next;
        });
    };

    const lines = useMemo(
        () => Array.from(cart.entries())
            .map(([id, quantity]) => ({ item: items.find((i) => i.id === id), quantity }))
            .filter((l): l is { item: MinibarItem; quantity: number } => !!l.item),
        [cart, items],
    );

    const total = lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
    const unidades = lines.reduce((sum, l) => sum + l.quantity, 0);

    const grouped = useMemo(() => {
        const map = new Map<string, MinibarItem[]>();
        for (const item of items) {
            const list = map.get(item.category);
            if (list) list.push(item);
            else map.set(item.category, [item]);
        }
        return map;
    }, [items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lines.length) return;

        setSaving(true);
        try {
            await counterSale.mutateAsync({ lines, method, notes: notes.trim() || undefined });
            toast({
                title: 'Venta registrada',
                description: `${unidades} producto${unidades > 1 ? 's' : ''} — $${total.toLocaleString('es-AR')}. Entra al cierre de caja.`,
            });
            onOpenChange(false);
        } catch (error) {
            // La plata quedó cargada: repetir la venta la duplicaría.
            if (error instanceof StockNoDescontadoError) {
                toast({
                    title: 'Cobro registrado, stock sin descontar',
                    description: 'El ingreso ya está en la caja. Ajustá el stock con un recuento.',
                    variant: 'destructive',
                });
                onOpenChange(false);
                return;
            }
            toast({
                title: 'No se pudo registrar la venta',
                description: error instanceof Error ? error.message : 'Ocurrió un error.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Venta de mostrador
                    </DialogTitle>
                    <DialogDescription>
                        Se cobra en el momento y entra al cierre de caja como ingreso.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 gap-4">
                    <ScrollArea className="flex-1 -mx-1 px-1">
                        <div className="space-y-4">
                            {CATEGORY_ORDER.map((cat) => {
                                const catItems = grouped.get(cat);
                                if (!catItems?.length) return null;

                                return (
                                    <div key={cat}>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                            {CATEGORY_LABELS[cat]}
                                        </p>
                                        <div className="space-y-1.5">
                                            {catItems.map((item) => {
                                                const qty = cart.get(item.id) || 0;
                                                const estado = stockStatus(item);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                                                            qty > 0
                                                                ? 'bg-primary/5 border-primary/20'
                                                                : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                        }`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                ${item.price.toLocaleString('es-AR')} ·{' '}
                                                                <span className={estado === 'ok' ? '' : 'text-destructive font-medium'}>
                                                                    {item.stock > 0 ? `quedan ${item.stock}` : 'sin stock'}
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                                            {qty > 0 && (
                                                                <>
                                                                    <Button
                                                                        type="button" variant="outline" size="icon"
                                                                        className="h-7 w-7 rounded-full"
                                                                        onClick={() => updateQty(item.id, -1)}
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </Button>
                                                                    <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                                                                </>
                                                            )}
                                                            <Button
                                                                type="button" variant={qty > 0 ? 'default' : 'outline'} size="icon"
                                                                className="h-7 w-7 rounded-full"
                                                                onClick={() => updateQty(item.id, 1)}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    <div className="space-y-4 pt-2 border-t">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="metodo">Cómo pagó</Label>
                                <Select value={method} onValueChange={(v) => setMethod(v as CounterSaleMethod)}>
                                    <SelectTrigger id="metodo"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {METODOS.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nota-venta">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                                <Input
                                    id="nota-venta"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Quién se lo llevó…"
                                />
                            </div>
                        </div>

                        <DialogFooter className="sm:justify-between items-center gap-3">
                            <span className="text-lg font-bold text-primary tabular-nums">
                                ${total.toLocaleString('es-AR')}
                            </span>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={saving || !lines.length}>
                                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Cobrar
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
