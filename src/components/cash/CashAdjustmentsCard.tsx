import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight, ArrowLeftRight, Scale, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { AdjustmentGroup } from '@/lib/cashClosing';
import type { AdjustmentLeg } from '@/hooks/useCashAdjustments';
import type { SettlementMethod } from '@/types/hotel';
import { cn } from '@/lib/utils';

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('es-AR')}`;
const label = (m: string) => PAYMENT_METHOD_LABELS[m] || m;

interface CashAdjustmentsCardProps {
  groups: AdjustmentGroup[];
  /** El formulario solo aparece mirando el turno abierto: el ajuste cae en él sí o sí. */
  showForm: boolean;
  /** Si se pueden borrar los ajustes listados (turno sin cerrar y rol admin). */
  canDelete: boolean;
  onCreate: (params: { legs: AdjustmentLeg[]; reason: string }) => void;
  onDelete: (group: AdjustmentGroup) => void;
  isCreating?: boolean;
}

type Mode = 'CAMBIO' | 'MOVIMIENTO';

/**
 * Los ajustes manuales de la caja del turno: la herramienta del admin para que
 * el cierre diga lo que hay de verdad en cada caja.
 *
 * Dos gestos y nada más. "Cambio entre métodos" mueve plata de una caja a otra
 * sin inventar ingresos —el huésped terminó transfiriendo lo que estaba cargado
 * como efectivo y no se sabe qué cobro fue—. "Retiro o ingreso" saca o mete
 * plata de un método: el sueldo que se lleva administración, el sobrante que
 * apareció al contar. El motivo es obligatorio porque el renglón es el rastro.
 */
export function CashAdjustmentsCard({
  groups,
  showForm,
  canDelete,
  onCreate,
  onDelete,
  isCreating,
}: CashAdjustmentsCardProps) {
  const [mode, setMode] = useState<Mode>('CAMBIO');
  const [fromMethod, setFromMethod] = useState<SettlementMethod>('CASH');
  const [toMethod, setToMethod] = useState<SettlementMethod>('TRANSFER');
  const [direction, setDirection] = useState<'SALE' | 'ENTRA'>('SALE');
  const [method, setMethod] = useState<SettlementMethod>('CASH');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');

  const amount = Number(amountInput);
  const sameMethod = mode === 'CAMBIO' && fromMethod === toMethod;
  const canSubmit =
    amount > 0 && reason.trim().length > 0 && !sameMethod && !isCreating;

  const submit = () => {
    if (!canSubmit) return;
    const legs: AdjustmentLeg[] =
      mode === 'CAMBIO'
        ? [
            { method: fromMethod, amount: -amount },
            { method: toMethod, amount },
          ]
        : [{ method, amount: direction === 'SALE' ? -amount : amount }];
    onCreate({ legs, reason: reason.trim() });
    setAmountInput('');
    setReason('');
  };

  return (
    <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Ajustes de caja
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Movimientos manuales de administración: cambiar plata de un método a otro o
          registrar un retiro. Ajustan los totales de arriba y quedan registrados con
          quién y por qué.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ajustes en este turno</p>
        ) : (
          groups.map((g) => (
            <div
              key={g.ids[0]}
              className="flex items-center gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <span className="text-[11px] text-slate-400 tabular-nums shrink-0 w-[74px]">
                {format(g.createdAt, 'd/M HH:mm', { locale: es })}
              </span>
              {g.kind === 'CAMBIO' ? (
                <span className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                  {label(g.fromMethod)}
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  {label(g.toMethod)}
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium">
                  {g.amount < 0 ? 'Retiro' : 'Ingreso'} · {label(g.method)}
                </span>
              )}
              <span className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {g.reason}
                {g.createdByName ? ` — ${g.createdByName}` : ''}
              </span>
              <span
                className={cn(
                  'font-medium tabular-nums shrink-0',
                  g.kind === 'AJUSTE' && g.amount < 0 && 'text-rose-600 dark:text-rose-400',
                  g.kind === 'AJUSTE' && g.amount > 0 && 'text-emerald-600'
                )}
              >
                {money(g.amount)}
              </span>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-rose-500"
                  aria-label="Deshacer ajuste"
                  onClick={() => onDelete(g)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))
        )}

        {showForm && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[190px]">
                <Label className="text-xs mb-1 block">Tipo de ajuste</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAMBIO">Cambio entre métodos</SelectItem>
                    <SelectItem value="MOVIMIENTO">Retiro o ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === 'CAMBIO' ? (
                <>
                  <div className="w-[150px]">
                    <Label className="text-xs mb-1 block">Sale de</Label>
                    <Select value={fromMethod} onValueChange={(v) => setFromMethod(v as SettlementMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[150px]">
                    <Label className="text-xs mb-1 block">Entra a</Label>
                    <Select value={toMethod} onValueChange={(v) => setToMethod(v as SettlementMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-[150px]">
                    <Label className="text-xs mb-1 block">Movimiento</Label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as 'SALE' | 'ENTRA')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SALE">Sale de la caja</SelectItem>
                        <SelectItem value="ENTRA">Entra a la caja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[150px]">
                    <Label className="text-xs mb-1 block">Método</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as SettlementMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="w-[130px]">
                <Label className="text-xs mb-1 block">Monto</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ej: 50000"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs mb-1 block">Motivo (obligatorio)</Label>
                <Input
                  placeholder={mode === 'CAMBIO'
                    ? 'Ej: el huésped terminó pagando por transferencia'
                    : 'Ej: retiro para sueldo'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <Button onClick={submit} disabled={!canSubmit}>
                {isCreating ? 'Guardando...' : 'Registrar ajuste'}
              </Button>
            </div>

            {sameMethod && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                El método de salida y el de entrada son el mismo: elegí dos distintos.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {mode === 'CAMBIO'
                ? 'Mueve el monto de un método al otro sin cambiar el total del turno.'
                : direction === 'SALE'
                  ? 'Baja ese método y el total del turno. Si es un gasto del hotel con comprobante, cargalo mejor como gasto para que entre en las estadísticas.'
                  : 'Sube ese método y el total del turno.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
