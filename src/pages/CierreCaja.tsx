import { useState, useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Wallet, Save, Calendar as CalendarIcon } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome, useCreateOtherIncome, useDeleteOtherIncome } from '@/hooks/useOtherIncome';
import { useCurrentAccountPayments } from '@/hooks/useCurrentAccount';
import { isCurrentAccountPayment } from '@/lib/currentAccount';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { useUpdateHotelSettings } from '@/hooks/useUpdateHotelSettings';
import { useCashFloatForDay, useSetCashFloat } from '@/hooks/useCashFloat';
import {
  useCashContributions,
  useCreateCashContribution,
  useDeleteCashContribution,
} from '@/hooks/useCashContributions';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import {
  summarizeExpenses,
  companyCashBalance,
  cashToDeposit as computeCashToDeposit,
  defaultClosingDay,
  resolveCashFloat,
  EXPENSE_METHOD_ORDER,
} from '@/lib/cashClosing';
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
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { cn, formatLocalDate, escapeHtml } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PRINT_FONT_LINK, PRINT_FONT_CSS } from '@/lib/printStyles';

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

export default function CierreCaja() {
  const { payments } = usePaymentOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();
  const { data: hotelSettings } = useHotelSettings();
  const updateSettings = useUpdateHotelSettings();
  const { data: allOtherIncome = [] } = useOtherIncome();
  const { data: allAccountPayments = [] } = useCurrentAccountPayments();
  const createOtherIncome = useCreateOtherIncome();
  const deleteOtherIncome = useDeleteOtherIncome();

  // Arranca en ayer: el hotel se sienta a la mañana a cerrar la caja del día
  // anterior, y abrir en "hoy" los obligaba a corregir la fecha siempre.
  const [day, setDay] = useState<string>(formatLocalDate(defaultClosingDay()));
  const [floatOverride, setFloatOverride] = useState<number | null>(null);
  const [newIncome, setNewIncome] = useState<{ description: string; method: PaymentMethod; amount: string }>({ description: '', method: 'CASH', amount: '' });
  const [newAporte, setNewAporte] = useState<{ notes: string; amount: string }>({ notes: '', amount: '' });

  const { data: allContributions = [] } = useCashContributions();
  const createContribution = useCreateCashContribution();
  const deleteContribution = useDeleteCashContribution();
  const savedFloat = useCashFloatForDay(day);
  const setCashFloat = useSetCashFloat();
  const { profileName } = useAppRole();
  const { user } = useAuth();
  // Lo tecleado gana mientras se edita; después el de ese día, y al final el
  // predeterminado del hotel.
  const cashFloat = floatOverride ?? resolveCashFloat(savedFloat, hotelSettings?.dailyCashFloat);

  // Cambiar de día descarta lo tecleado: si no, el monto de un día se arrastraba
  // al siguiente y se guardaba en el equivocado.
  useEffect(() => setFloatOverride(null), [day]);

  const otherIncomeDay = useMemo(
    () => allOtherIncome.filter((o) => formatLocalDate(new Date(o.date)) === day),
    [allOtherIncome, day]
  );

  const accountPaymentsDay = useMemo(
    () => allAccountPayments.filter((p) => formatLocalDate(new Date(p.date)) === day),
    [allAccountPayments, day]
  );

  // PAID payments + external income dated on the selected day, grouped by method
  const { byMethod, totalIngresos, cashTotal, aCuentaCorriente } = useMemo(() => {
    const byMethod: Record<string, number> = {};
    for (const m of PAYMENT_METHODS) byMethod[m.value] = 0;
    let total = 0;
    // Lo que se cargó a cuentas corrientes hoy. Va aparte y no suma: la reserva
    // queda saldada pero a la caja no entró un peso.
    let aCuentaCorriente = 0;

    for (const p of payments) {
      if (p.status !== 'PAID' || formatLocalDate(new Date(p.date)) !== day) continue;
      if (isCurrentAccountPayment(p)) {
        aCuentaCorriente += p.amount;
        continue;
      }
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }
    for (const o of otherIncomeDay) {
      byMethod[o.method] = (byMethod[o.method] || 0) + o.amount;
      total += o.amount;
    }
    // Lo que los huéspedes pagaron hoy de sus cuentas: esto sí es plata que entró,
    // y entra por el método con el que la trajeron.
    for (const p of accountPaymentsDay) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }

    return { byMethod, totalIngresos: total, cashTotal: byMethod['CASH'] || 0, aCuentaCorriente };
  }, [payments, otherIncomeDay, accountPaymentsDay, day]);

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
    const dayExpenses = allExpenses
      .filter((e) => formatLocalDate(new Date(e.date)) === day)
      .sort((a, b) => b.amount - a.amount);
    return { list: dayExpenses, ...summarizeExpenses(dayExpenses) };
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

  // Los gastos en efectivo salieron del cajón: rendirlos otra vez sería contar
  // dos veces la misma plata.
  const cashToDeposit = computeCashToDeposit({
    cashIncome: cashTotal,
    cashFloat,
    // Solo lo que salió de la recaudación: lo pagado con la plata de la empresa
    // es otra caja y rendirla no corresponde.
    cashExpenses: expenses.cashRecaudacion,
  });
  const totalDelDia = totalIngresos - expenses.total;

  // La caja de la empresa. El saldo es histórico —lo que pusieron el lunes sigue
  // estando el miércoles— así que se calcula sobre todo, no sobre el día.
  const aportesDia = useMemo(
    () => allContributions.filter((c) => formatLocalDate(new Date(c.date)) === day),
    [allContributions, day]
  );
  const aportesDiaTotal = aportesDia.reduce((sum, c) => sum + c.amount, 0);
  const saldoEmpresa = useMemo(
    () => companyCashBalance(allContributions, allExpenses),
    [allContributions, allExpenses]
  );

  const dayLabel = format(new Date(day + 'T00:00:00'), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  const author = { id: user?.id, name: profileName || user?.email || undefined };

  const addAporte = async () => {
    const amount = Number(newAporte.amount);
    if (!amount || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresá cuánto puso la empresa', variant: 'destructive' });
      return;
    }
    try {
      await createContribution.mutateAsync({
        date: new Date(day + 'T00:00:00'),
        amount,
        notes: newAporte.notes.trim() || undefined,
        createdBy: author.id,
        createdByName: author.name,
      });
      setNewAporte({ notes: '', amount: '' });
      toast({ title: 'Aporte registrado', description: `${money(amount)} a la caja de la empresa` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo registrar el aporte', variant: 'destructive' });
    }
  };

  /** Fija el fondo para ESTE día, sin tocar el de los demás. */
  const saveFloatForDay = async () => {
    try {
      await setCashFloat.mutateAsync({ day, amount: cashFloat, setBy: author.id, setByName: author.name });
      setFloatOverride(null);
      toast({ title: 'Fondo fijo guardado', description: `${money(cashFloat)} para el ${day}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el fondo fijo del día', variant: 'destructive' });
    }
  };

  /** Lo deja como habitual: los días que no tengan el suyo heredan este. */
  const saveFloatAsDefault = async () => {
    if (!hotelSettings) return;
    try {
      await updateSettings.mutateAsync({ id: hotelSettings.id, data: { dailyCashFloat: cashFloat } });
      toast({ title: 'Fondo fijo habitual guardado', description: `Predeterminado: ${money(cashFloat)}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el fondo fijo', variant: 'destructive' });
    }
  };

  const handlePrint = useCallback(() => {
    const w = window.open('', '', 'width=800,height=600');
    if (!w) return;
    const h = escapeHtml;
    const methodRows = PAYMENT_METHODS.map(
      (m) => `<tr><td>${h(m.label)}</td><td class="num">${money(byMethod[m.value] || 0)}</td></tr>`
    ).join('');
    const expenseTypeRows = Object.entries(expenses.byType)
      .map(([t, v]) => `<tr><td>${h(EXPENSE_TYPE_LABELS[t] || t)}</td><td class="num">${money(v)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    // De qué cuenta salió cada peso. Es la mitad que faltaba: sin esto el cierre
    // decía en qué se gastó pero no de dónde salió la plata.
    const expenseMethodRows = EXPENSE_METHOD_ORDER
      .filter((m) => expenses.byMethod[m])
      .map((m) => `<tr><td>${h(PAYMENT_METHOD_LABELS[m] || m)}</td><td class="num">${money(expenses.byMethod[m])}</td></tr>`)
      .join('')
      + (expenses.unspecified > 0
        ? `<tr><td>Sin especificar</td><td class="num">${money(expenses.unspecified)}</td></tr>`
        : '')
      || '<tr><td colspan="2">Sin gastos</td></tr>';
    // Cada gasto con su descripción: en qué se gastó de verdad.
    // Cada gasto dice también de qué caja salió: es lo que permite cuadrar.
    const cajaLabel = (e: typeof expenses.list[number]) =>
      e.method !== 'CASH' ? '' : ` · ${(e.cashSource ?? 'RECAUDACION') === 'EMPRESA' ? 'caja empresa' : 'recaudación'}`;
    const expenseDetailRows = expenses.list
      .map((e) => `<tr><td>${h(EXPENSE_TYPE_LABELS[e.expenseType] || e.expenseType)}${e.description ? ` — ${h(e.description)}` : ''}<br><span class="muted">${h((e.method ? PAYMENT_METHOD_LABELS[e.method] || e.method : 'sin especificar') + cajaLabel(e))}</span></td><td class="num">${money(e.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    const aporteRows = aportesDia
      .map((c) => `<tr><td>${h(c.notes || 'Aporte a la caja')}${c.createdByName ? `<br><span class="muted">${h(c.createdByName)}</span>` : ''}</td><td class="num">${money(c.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin aportes este día</td></tr>';
    const deudaRows = deuda.rows
      .map((r) => `<tr><td>${h(r.name)} — Hab. ${h(r.room)}</td><td class="num">${money(r.owed)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin deudas</td></tr>';
    const otherIncomeRows = otherIncomeDay
      .map((o) => `<tr><td>${h(o.description)} (${h(PAYMENT_METHODS.find(m => m.value === o.method)?.label || o.method)})</td><td class="num">${money(o.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin ingresos externos</td></tr>';
    w.document.write(`<!DOCTYPE html><html><head><title>Cierre de Caja ${h(day)}</title>
    ${PRINT_FONT_LINK}
    <style>
      ${PRINT_FONT_CSS}
      body{max-width:720px;margin:0 auto;padding:32px;color:#1e293b}
      h1{font-size:20px;color:#003366;margin:0}.sub{color:#64748b;font-size:13px;margin-bottom:20px;text-transform:capitalize}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#003366;border-bottom:2px solid #D4A017;padding-bottom:4px;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .muted{color:#94a3b8;font-size:11px}
      .tot{font-weight:700;border-top:2px solid #1e293b}
      .grand{font-size:16px;font-weight:700;color:#003366}
    </style></head><body>
    <h1>Cierre de Caja — ${h(hotelSettings?.hotelName || 'Hotel')}</h1>
    <div class="sub">${h(dayLabel)}</div>
    <h2>Ingresos por método</h2><table>${methodRows}
      <tr class="tot"><td>Total ingresos</td><td class="num">${money(totalIngresos)}</td></tr>
      ${aCuentaCorriente > 0
        ? `<tr><td>A cuenta corriente (no ingresó)</td><td class="num">${money(aCuentaCorriente)}</td></tr>`
        : ''}</table>
    <h2>Caja (efectivo)</h2><table>
      <tr><td>Efectivo cobrado</td><td class="num">${money(cashTotal)}</td></tr>
      <tr><td>Menos fondo fijo</td><td class="num">-${money(cashFloat)}</td></tr>
      <tr><td>Menos gastos pagados de la recaudación</td><td class="num">-${money(expenses.cashRecaudacion)}</td></tr>
      <tr class="tot"><td>Efectivo a rendir</td><td class="num">${money(cashToDeposit)}</td></tr></table>
    <h2>Gastos por rubro</h2><table>${expenseTypeRows}
      <tr class="tot"><td>Total gastos</td><td class="num">${money(expenses.total)}</td></tr></table>
    <h2>Gastos por cuenta</h2><table>${expenseMethodRows}</table>
    <h2>Detalle de gastos</h2><table>${expenseDetailRows}</table>
    <h2>Caja de la empresa</h2><table>
      <tr><td>Aportes de este día</td><td class="num">${money(aportesDiaTotal)}</td></tr>
      <tr><td>Gastado de esta caja</td><td class="num">-${money(expenses.cashEmpresa)}</td></tr>
      <tr class="tot"><td>Saldo disponible</td><td class="num">${money(saldoEmpresa)}</td></tr></table>
    <table>${aporteRows}</table>
    <h2>Ingresos externos</h2><table>${otherIncomeRows}</table>
    <h2>Deudas (DEBE)</h2><table>${deudaRows}
      <tr class="tot"><td>Total deuda</td><td class="num">${money(deuda.total)}</td></tr></table>
    <h2>Resultado del día</h2><table>
      <tr class="tot grand"><td>Total del día (ingresos − gastos)</td><td class="num">${money(totalDelDia)}</td></tr></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [byMethod, expenses, deuda, otherIncomeDay, aCuentaCorriente, day, dayLabel, cashFloat, cashTotal, cashToDeposit, totalIngresos, totalDelDia, hotelSettings, aportesDia, aportesDiaTotal, saldoEmpresa]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre de Caja"
        description="Se cierra la caja del día anterior. Ingresos por método, gastos por rubro y cuenta, deudas y efectivo a rendir."
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
          <Label className="text-xs mb-1 block flex items-center gap-1"><Wallet className="w-3 h-3" /> Fondo fijo</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={0} step={1000}
              value={cashFloat}
              onChange={(e) => setFloatOverride(Number(e.target.value) || 0)}
              className="w-[140px]"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={saveFloatForDay}
              disabled={setCashFloat.isPending}
              title="Guardar el fondo fijo de este día"
            >
              <Save className="w-4 h-4 mr-1.5" /> Este día
            </Button>
            <Button variant="ghost" size="sm" onClick={saveFloatAsDefault} title="Dejarlo como monto habitual para los días que no tengan uno propio">
              Habitual
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {savedFloat !== null
              ? 'Fijado para este día.'
              : `Heredado del habitual (${money(hotelSettings?.dailyCashFloat ?? 0)}).`}
          </p>
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
            {/* Abajo de la raya del total: es lo que NO entró */}
            {aCuentaCorriente > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted-foreground">A cuenta corriente (no ingresó)</span>
                <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                  {money(aCuentaCorriente)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caja / efectivo a rendir */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base">Caja (efectivo)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Efectivo cobrado</span><span className="font-medium tabular-nums">{money(cashTotal)}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Menos fondo fijo</span><span className="font-medium tabular-nums text-rose-500">-{money(cashFloat)}</span></div>
            {/* La plata que se pagó del cajón ya no está: rendirla otra vez sería
                contarla dos veces. */}
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">Menos gastos pagados de la recaudación</span>
              <span className="font-medium tabular-nums text-rose-500">-{money(expenses.cashRecaudacion)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Efectivo a rendir</span>
              <span className={cashToDeposit < 0 ? 'tabular-nums text-rose-600' : 'tabular-nums'}>{money(cashToDeposit)}</span>
            </div>
            {cashToDeposit < 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Se gastó más efectivo del que entró: la diferencia salió del fondo fijo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Gastos del día — en qué se gastó y de qué cuenta salió */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Gastos del día</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {expenses.list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin gastos registrados este día</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Por rubro</p>
                    {Object.entries(expenses.byType).map(([t, v]) => (
                      <div key={t} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-muted-foreground">{EXPENSE_TYPE_LABELS[t] || t}</span>
                        <span className="font-medium tabular-nums">{money(v)}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Por cuenta</p>
                    {EXPENSE_METHOD_ORDER.filter(m => expenses.byMethod[m]).map((m) => (
                      <div key={m} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[m] || m}</span>
                        <span className="font-medium tabular-nums">{money(expenses.byMethod[m])}</span>
                      </div>
                    ))}
                    {/* Los cargados antes de que se pidiera el medio de pago */}
                    {expenses.unspecified > 0 && (
                      <div className="flex justify-between text-sm py-1">
                        <span className="text-amber-600 dark:text-amber-400">Sin especificar</span>
                        <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{money(expenses.unspecified)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* El detalle: qué se compró, no solo cuánto */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Detalle</p>
                  {expenses.list.map((e) => (
                    <div key={e.id} className="flex items-baseline gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <span className="text-muted-foreground shrink-0">{EXPENSE_TYPE_LABELS[e.expenseType] || e.expenseType}</span>
                      <span className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">{e.description || '—'}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {e.method ? PAYMENT_METHOD_LABELS[e.method] || e.method : 'sin especificar'}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">{money(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
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

        {/* Caja de la empresa — la plata que pone el hotel para comprar */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Caja de la empresa</CardTitle>
            <p className="text-xs text-muted-foreground">
              Efectivo que pone el hotel para las compras del día. No es un ingreso y no se rinde:
              va aparte de lo cobrado a huéspedes.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Aportes de este día</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">{money(aportesDiaTotal)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Gastado de esta caja</p>
                <p className="text-lg font-bold tabular-nums text-rose-600">{money(expenses.cashEmpresa)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Saldo disponible</p>
                <p className={cn('text-lg font-bold tabular-nums', saldoEmpresa < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100')}>
                  {money(saldoEmpresa)}
                </p>
              </div>
            </div>

            {saldoEmpresa < 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Se gastó más de lo que la empresa puso: hay que reponer la caja.
              </p>
            )}

            {aportesDia.length > 0 && (
              <div>
                {aportesDia.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-muted-foreground flex-1">{c.notes || 'Aporte a la caja'}</span>
                    <span className="text-xs text-slate-400 mr-3">{c.createdByName || ''}</span>
                    <span className="font-medium tabular-nums mr-2">{money(c.amount)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteContribution.mutate(c)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs mb-1 block">Detalle (opcional)</Label>
                <Input
                  value={newAporte.notes}
                  onChange={(e) => setNewAporte((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Ej: reposición para compras"
                />
              </div>
              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">Monto</Label>
                <Input
                  type="number" min={0}
                  value={newAporte.amount}
                  onChange={(e) => setNewAporte((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Button onClick={addAporte} disabled={createContribution.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Registrar aporte
              </Button>
            </div>
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
