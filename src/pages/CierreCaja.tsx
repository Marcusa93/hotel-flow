import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Wallet, Save, Calendar as CalendarIcon } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome, useCreateOtherIncome, useDeleteOtherIncome } from '@/hooks/useOtherIncome';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { useUpdateHotelSettings } from '@/hooks/useUpdateHotelSettings';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { PaymentMethod } from '@/types/hotel';
import { PAYMENT_METHODS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { formatLocalDate, escapeHtml } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

export default function CierreCaja() {
  const { payments } = usePaymentOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();
  const { data: hotelSettings } = useHotelSettings();
  const updateSettings = useUpdateHotelSettings();
  const { data: allOtherIncome = [] } = useOtherIncome();
  const createOtherIncome = useCreateOtherIncome();
  const deleteOtherIncome = useDeleteOtherIncome();

  const [day, setDay] = useState<string>(formatLocalDate(new Date()));
  const [floatOverride, setFloatOverride] = useState<number | null>(null);
  const [newIncome, setNewIncome] = useState<{ description: string; method: PaymentMethod; amount: string }>({ description: '', method: 'CASH', amount: '' });

  const cashFloat = floatOverride ?? hotelSettings?.dailyCashFloat ?? 0;

  const otherIncomeDay = useMemo(
    () => allOtherIncome.filter((o) => formatLocalDate(new Date(o.date)) === day),
    [allOtherIncome, day]
  );

  // PAID payments + external income dated on the selected day, grouped by method
  const { byMethod, totalIngresos, cashTotal } = useMemo(() => {
    const byMethod: Record<string, number> = {};
    for (const m of PAYMENT_METHODS) byMethod[m.value] = 0;
    let total = 0;
    for (const p of payments) {
      if (p.status !== 'PAID' || formatLocalDate(new Date(p.date)) !== day) continue;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }
    for (const o of otherIncomeDay) {
      byMethod[o.method] = (byMethod[o.method] || 0) + o.amount;
      total += o.amount;
    }
    return { byMethod, totalIngresos: total, cashTotal: byMethod['CASH'] || 0 };
  }, [payments, otherIncomeDay, day]);

  const addOtherIncome = async () => {
    const amount = Number(newIncome.amount);
    if (!newIncome.description.trim() || !amount || amount <= 0) {
      toast({ title: 'Datos incompletos', description: 'Ingresá descripción y monto válido', variant: 'destructive' });
      return;
    }
    try {
      await createOtherIncome.mutateAsync({
        date: new Date(day + 'T00:00:00'),
        description: newIncome.description.trim(),
        method: newIncome.method,
        amount,
      });
      setNewIncome({ description: '', method: 'CASH', amount: '' });
      toast({ title: 'Ingreso externo registrado', description: `${money(amount)} — ${newIncome.description.trim()}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo registrar el ingreso', variant: 'destructive' });
    }
  };

  // Expenses via the expenses hook (filtered locally by day)
  const { data: allExpenses = [] } = useExpenses();
  const expenses = useMemo(() => {
    const dayExpenses = allExpenses.filter((e) => formatLocalDate(new Date(e.date)) === day);
    const byType: Record<string, number> = {};
    let total = 0;
    for (const e of dayExpenses) {
      byType[e.expenseType] = (byType[e.expenseType] || 0) + e.amount;
      total += e.amount;
    }
    return { list: dayExpenses, byType, total };
  }, [allExpenses, day]);

  // Deuda del día: guests checking in that day whose booking isn't fully paid
  const deuda = useMemo(() => {
    const rows: { name: string; room: string; owed: number }[] = [];
    let total = 0;
    for (const b of bookings) {
      if (formatLocalDate(new Date(b.checkInDate)) !== day) continue;
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue;
      const paid = payments
        .filter((p) => p.bookingId === b.id && p.status === 'PAID')
        .reduce((s, p) => s + p.amount, 0);
      const owed = (b.totalAmount || 0) - paid;
      if (owed > 0) {
        const guest = guests.find((g) => g.id === b.guestId);
        const room = rooms.find((r) => r.id === b.roomId);
        rows.push({ name: guest?.fullName || 'Huésped', room: room?.roomNumber || '-', owed });
        total += owed;
      }
    }
    return { rows, total };
  }, [bookings, payments, guests, rooms, day]);

  const cashToDeposit = cashTotal - cashFloat;
  const totalDelDia = totalIngresos - expenses.total;

  const dayLabel = format(new Date(day + 'T00:00:00'), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  const saveFloatAsDefault = async () => {
    if (!hotelSettings) return;
    try {
      await updateSettings.mutateAsync({ id: hotelSettings.id, data: { dailyCashFloat: cashFloat } });
      toast({ title: 'Fijo del día guardado', description: `Predeterminado: ${money(cashFloat)}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el fijo del día', variant: 'destructive' });
    }
  };

  const handlePrint = useCallback(() => {
    const w = window.open('', '', 'width=800,height=600');
    if (!w) return;
    const h = escapeHtml;
    const methodRows = PAYMENT_METHODS.map(
      (m) => `<tr><td>${h(m.label)}</td><td class="num">${money(byMethod[m.value] || 0)}</td></tr>`
    ).join('');
    const expenseRows = Object.entries(expenses.byType)
      .map(([t, v]) => `<tr><td>${h(EXPENSE_TYPE_LABELS[t] || t)}</td><td class="num">${money(v)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    const deudaRows = deuda.rows
      .map((r) => `<tr><td>${h(r.name)} — Hab. ${h(r.room)}</td><td class="num">${money(r.owed)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin deudas</td></tr>';
    const otherIncomeRows = otherIncomeDay
      .map((o) => `<tr><td>${h(o.description)} (${h(PAYMENT_METHODS.find(m => m.value === o.method)?.label || o.method)})</td><td class="num">${money(o.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin ingresos externos</td></tr>';
    w.document.write(`<!DOCTYPE html><html><head><title>Cierre de Caja ${h(day)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,sans-serif;max-width:720px;margin:0 auto;padding:32px;color:#1e293b}
      h1{font-size:20px;color:#003366;margin:0}.sub{color:#64748b;font-size:13px;margin-bottom:20px;text-transform:capitalize}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#003366;border-bottom:2px solid #D4A017;padding-bottom:4px;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .tot{font-weight:700;border-top:2px solid #1e293b}
      .grand{font-size:16px;font-weight:700;color:#003366}
    </style></head><body>
    <h1>Cierre de Caja — ${h(hotelSettings?.hotelName || 'Hotel')}</h1>
    <div class="sub">${h(dayLabel)}</div>
    <h2>Ingresos por método</h2><table>${methodRows}
      <tr class="tot"><td>Total ingresos</td><td class="num">${money(totalIngresos)}</td></tr></table>
    <h2>Caja (efectivo)</h2><table>
      <tr><td>Efectivo del día</td><td class="num">${money(cashTotal)}</td></tr>
      <tr><td>Menos fijo del día</td><td class="num">-${money(cashFloat)}</td></tr>
      <tr class="tot"><td>Efectivo a rendir</td><td class="num">${money(cashToDeposit)}</td></tr></table>
    <h2>Gastos del día</h2><table>${expenseRows}
      <tr class="tot"><td>Total gastos</td><td class="num">${money(expenses.total)}</td></tr></table>
    <h2>Ingresos externos</h2><table>${otherIncomeRows}</table>
    <h2>Deudas (DEBE)</h2><table>${deudaRows}
      <tr class="tot"><td>Total deuda</td><td class="num">${money(deuda.total)}</td></tr></table>
    <h2>Resultado del día</h2><table>
      <tr class="tot grand"><td>Total del día (ingresos − gastos)</td><td class="num">${money(totalDelDia)}</td></tr></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [byMethod, expenses, deuda, otherIncomeDay, day, dayLabel, cashFloat, cashTotal, cashToDeposit, totalIngresos, totalDelDia, hotelSettings]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre de Caja"
        description="Resumen diario de caja: ingresos por método, gastos, deudas y efectivo a rendir"
        actions={
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir cierre
          </Button>
        }
      />

      {/* Day selector */}
      <div className="flex flex-wrap items-end gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-sm">
        <div>
          <Label className="text-xs mb-1 block flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Día</Label>
          <Input type="date" value={day} max={formatLocalDate(new Date())} onChange={(e) => setDay(e.target.value)} className="w-[180px]" />
        </div>
        <div>
          <Label className="text-xs mb-1 block flex items-center gap-1"><Wallet className="w-3 h-3" /> Fijo del día</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={0} step={1000}
              value={cashFloat}
              onChange={(e) => setFloatOverride(Number(e.target.value) || 0)}
              className="w-[140px]"
            />
            <Button variant="ghost" size="sm" onClick={saveFloatAsDefault} title="Guardar como predeterminado">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize ml-auto">{dayLabel}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ingresos por método */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base">Ingresos por método</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.value} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium tabular-nums">{money(byMethod[m.value] || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Total ingresos</span>
              <span className="text-emerald-600 tabular-nums">{money(totalIngresos)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Caja / efectivo a rendir */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base">Caja (efectivo)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Efectivo del día</span><span className="font-medium tabular-nums">{money(cashTotal)}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Menos fijo del día</span><span className="font-medium tabular-nums text-rose-500">-{money(cashFloat)}</span></div>
            <div className="flex justify-between pt-2 border-t font-bold"><span>Efectivo a rendir</span><span className="tabular-nums">{money(cashToDeposit)}</span></div>
          </CardContent>
        </Card>

        {/* Gastos del día */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base">Gastos del día</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(expenses.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin gastos registrados este día</p>
            ) : (
              Object.entries(expenses.byType).map(([t, v]) => (
                <div key={t} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-muted-foreground">{EXPENSE_TYPE_LABELS[t] || t}</span>
                  <span className="font-medium tabular-nums">{money(v)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total gastos</span><span className="text-rose-600 tabular-nums">{money(expenses.total)}</span></div>
          </CardContent>
        </Card>

        {/* Deudas */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base">Deudas del día (DEBE)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {deuda.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin deudas registradas este día</p>
            ) : (
              deuda.rows.map((r, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-muted-foreground">{r.name} — Hab. {r.room}</span>
                  <span className="font-medium tabular-nums text-amber-600">{money(r.owed)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total deuda</span><span className="text-amber-600 tabular-nums">{money(deuda.total)}</span></div>
          </CardContent>
        </Card>

        {/* Ingresos externos */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Ingresos externos / adicionales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {otherIncomeDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ingresos externos este día</p>
            ) : (
              otherIncomeDay.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-muted-foreground flex-1">{o.description}</span>
                  <span className="text-xs text-slate-400 mr-3">{PAYMENT_METHODS.find(m => m.value === o.method)?.label || o.method}</span>
                  <span className="font-medium tabular-nums mr-2">{money(o.amount)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteOtherIncome.mutate(o.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
            {/* Add form */}
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs mb-1 block">Descripción</Label>
                <Input value={newIncome.description} onChange={(e) => setNewIncome(p => ({ ...p, description: e.target.value }))} placeholder="Ej: Alquiler de salón" />
              </div>
              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">Método</Label>
                <Select value={newIncome.method} onValueChange={(v) => setNewIncome(p => ({ ...p, method: v as PaymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px]">
                <Label className="text-xs mb-1 block">Monto</Label>
                <Input type="number" min={0} value={newIncome.amount} onChange={(e) => setNewIncome(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <Button onClick={addOtherIncome} disabled={createOtherIncome.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado del día */}
      <Card className="brass-top lift glass border-none overflow-hidden">
        <CardContent className="p-7 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total del día · ingresos − gastos</p>
            <p className="num-display text-5xl font-semibold text-primary dark:text-accent mt-2">{money(totalDelDia)}</p>
          </div>
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
            <Wallet className="w-8 h-8 text-accent" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
