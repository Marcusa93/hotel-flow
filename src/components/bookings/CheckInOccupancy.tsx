import { Minus, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, guestsLabel } from '@/lib/utils';
import type { OccupancyPricing } from '@/lib/occupancyPricing';

/** Lo que se anotó al reservar y lo que se corrige al entrar. */
export interface CheckInOccupancyValue {
  adults: number;
  children: number;
  infants: number;
}

interface CheckInOccupancyProps {
  value: CheckInOccupancyValue;
  onChange: (value: CheckInOccupancyValue) => void;
  /** El tramo que corresponde a la ocupación actual */
  pricing: OccupancyPricing | null;
  /** Capacidad de la habitación, para avisar si se pasan */
  maxGuests?: number;
  nights: number;
  /** Total con el que está cargada la reserva hoy */
  currentTotal: number;
  /** Total que quedaría con la ocupación de arriba */
  newTotal: number;
  className?: string;
}

const ROWS: { key: keyof CheckInOccupancyValue; label: string; hint?: string; min: number }[] = [
  { key: 'adults', label: 'Adultos', min: 1 },
  { key: 'children', label: 'Niños (5+)', min: 0 },
  { key: 'infants', label: 'Menores de 5', hint: 'no se cobran', min: 0 },
];

/**
 * Cuántas personas entran realmente, corregible en el momento del check-in.
 *
 * La reserva se toma con una cantidad y a veces entra otra —reservaron cinco y
 * llegaron cuatro—, y como el precio sale de la cantidad de personas, esa
 * diferencia es plata. Vive acá adentro para que los distintos caminos de
 * check-in pregunten lo mismo y calculen igual.
 */
export function CheckInOccupancy({
  value,
  onChange,
  pricing,
  maxGuests,
  nights,
  currentTotal,
  newTotal,
  className,
}: CheckInOccupancyProps) {
  const occupants = value.adults + value.children + value.infants;
  const isOverCapacity = maxGuests !== undefined && occupants > maxGuests;
  const difference = newTotal - currentTotal;

  const step = (key: keyof CheckInOccupancyValue, delta: number, min: number) => {
    onChange({ ...value, [key]: Math.max(min, Math.min(10, value[key] + delta)) });
  };

  return (
    <div className={cn('rounded-lg border p-3 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Users className="w-4 h-4 text-muted-foreground" />
        ¿Cuántas personas ingresan?
      </div>

      <div className="space-y-1.5">
        {ROWS.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              {row.label}
              {row.hint && <span className="text-xs text-muted-foreground"> — {row.hint}</span>}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => step(row.key, -1, row.min)}
                disabled={value[row.key] <= row.min}
                aria-label={`Quitar ${row.label}`}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{value[row.key]}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => step(row.key, 1, row.min)}
                disabled={value[row.key] >= 10}
                aria-label={`Agregar ${row.label}`}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isOverCapacity && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Entran {occupants} personas en una habitación para {maxGuests}.
        </p>
      )}

      {pricing && nights > 0 && (
        <div className="pt-2 border-t space-y-1">
          {/* La tarifa y el total van en renglones separados a propósito: con una
              promoción el total no es tarifa × noches, y ponerlos en la misma
              línea hacía leer una multiplicación que no cierra. */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tarifa {guestsLabel(pricing.pricingType.maxGuests)}</span>
            <span className="tabular-nums">
              ${pricing.nightlyPrice.toLocaleString('es-AR')}/noche · {nights} noche{nights !== 1 ? 's' : ''}
            </span>
          </div>
          {/* La elegida a mano no sigue a la ocupación: si entran más de los que
              cubre hay que decirlo, o el precio queda corto sin que nadie lo vea. */}
          {pricing.isManual && (
            <p
              className={cn(
                'text-xs',
                pricing.billable > pricing.pricingType.maxGuests
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground'
              )}
            >
              {pricing.billable > pricing.pricingType.maxGuests
                ? `Entran ${pricing.billable} y la tarifa elegida a mano cubre ${pricing.pricingType.maxGuests}: el precio no se ajusta solo.`
                : 'Tarifa elegida a mano: no se recalcula por la ocupación.'}
            </p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total</span>
            <span className={cn('font-semibold tabular-nums', difference !== 0 && 'text-primary')}>
              ${newTotal.toLocaleString('es-AR')}
            </span>
          </div>
          {difference !== 0 && (
            <p className="text-xs text-muted-foreground">
              Antes: ${currentTotal.toLocaleString('es-AR')}
              {difference > 0
                ? ` (+$${difference.toLocaleString('es-AR')})`
                : ` (−$${Math.abs(difference).toLocaleString('es-AR')})`}
            </p>
          )}
          {value.infants > 0 && (
            <p className="text-xs text-muted-foreground">
              {value.infants} menor{value.infants > 1 ? 'es' : ''} de 5 años sin cargo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
