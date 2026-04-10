import { useState } from 'react';
import { useMinibarItems, MinibarItem } from '@/hooks/useMinibarItems';
import { useCreateBookingCharge } from '@/hooks/useCreateBookingCharge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Minus, Plus, ShoppingCart, Wine, Cookie, GlassWater, Package } from 'lucide-react';

interface MinibarQuickAddProps {
  bookingId: string;
  onDone?: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  bebida: { label: 'Bebidas', icon: <GlassWater className="w-3.5 h-3.5" /> },
  alcohol: { label: 'Alcohol', icon: <Wine className="w-3.5 h-3.5" /> },
  snack: { label: 'Snacks', icon: <Cookie className="w-3.5 h-3.5" /> },
  otro: { label: 'Otros', icon: <Package className="w-3.5 h-3.5" /> },
};

export function MinibarQuickAdd({ bookingId, onDone }: MinibarQuickAddProps) {
  const { data: items = [], isLoading } = useMinibarItems();
  const createCharge = useCreateBookingCharge();
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const updateQty = (itemId: string, delta: number) => {
    setCart(prev => {
      const next = new Map(prev);
      const current = next.get(itemId) || 0;
      const newQty = current + delta;
      if (newQty <= 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, newQty);
      }
      return next;
    });
  };

  const totalItems = Array.from(cart.values()).reduce((s, q) => s + q, 0);
  const totalAmount = Array.from(cart.entries()).reduce((sum, [id, qty]) => {
    const item = items.find(i => i.id === id);
    return sum + (item?.price || 0) * qty;
  }, 0);

  const handleSubmit = async () => {
    if (cart.size === 0) return;
    setSubmitting(true);

    try {
      const promises = Array.from(cart.entries()).map(([itemId, qty]) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return Promise.resolve();
        return createCharge.mutateAsync({
          bookingId,
          category: 'MINIBAR',
          description: item.name,
          amount: item.price,
          quantity: qty,
        });
      });

      await Promise.all(promises);

      toast({
        title: 'Consumos registrados',
        description: `${totalItems} producto${totalItems > 1 ? 's' : ''} — $${totalAmount.toLocaleString('es-AR')}`,
      });

      setCart(new Map());
      onDone?.();
    } catch (error) {
      toast({
        title: 'Error al registrar consumos',
        description: error instanceof Error ? error.message : 'Ocurrió un error.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando productos...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No hay productos de minibar configurados.
      </div>
    );
  }

  // Group by category
  const grouped = items.reduce<Record<string, MinibarItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const categoryOrder = ['bebida', 'alcohol', 'snack', 'otro'];

  return (
    <div className="space-y-4">
      {categoryOrder.map(cat => {
        const catItems = grouped[cat];
        if (!catItems?.length) return null;
        const meta = CATEGORY_META[cat] || CATEGORY_META.otro;

        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-2">
              {meta.icon}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {catItems.map(item => {
                const qty = cart.get(item.id) || 0;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      qty > 0
                        ? 'bg-primary/5 border border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">${item.price.toLocaleString('es-AR')}</p>
                    </div>

                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {qty > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQty(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      )}
                      {qty > 0 && (
                        <span className="w-6 text-center text-sm font-bold">{qty}</span>
                      )}
                      <Button
                        variant={qty > 0 ? 'default' : 'outline'}
                        size="icon"
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

      {/* Cart summary + submit */}
      {totalItems > 0 && (
        <div className="sticky bottom-0 pt-3 border-t bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {totalItems} producto{totalItems > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-lg font-bold text-primary">
              ${totalAmount.toLocaleString('es-AR')}
            </span>
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Registrando...' : `Cargar consumos ($${totalAmount.toLocaleString('es-AR')})`}
          </Button>
        </div>
      )}
    </div>
  );
}
