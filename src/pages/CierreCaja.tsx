import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Printer, Wallet, Lock, LockOpen, CheckCircle2, AlertTriangle,
  Play, Plus, Trash2,
} from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome, useCreateOtherIncome, useDeleteOtherIncome } from '@/hooks/useOtherIncome';
import { useCurrentAccountPayments } from '@/hooks/useCurrentAccount';
import { isCurrentAccountPayment } from '@/lib/currentAccount';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import {
  useCashContributions,
  useCreateCashContribution,
  useDeleteCashContribution,
} from '@/hooks/useCashContributions';
import {
  useCashSessions,
  useOpenCashSession,
  useCloseCashSession,
  useReopenCashSession,
} from '@/hooks/useCashSessions';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import {
  summarizeExpenses,
  companyCashBalance,
  cashToDeposit as computeCashToDeposit,
  belongsToSession,
  sessionDateRange,
  EXPENSE_METHOD_ORDER,
} from '@/lib/cashClosing';
import { formatLocalDate, escapeHtml } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { PaymentMethod } from '@/types/hotel';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PRINT_FONT_LINK, PRINT_FONT_CSS } from '@/lib/printStyles';

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

export default function CierreCaja() {
  const { payments } = usePaymentOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();
  const { data: hotelSettings } = useHotelSettings();
  const { data: allOtherIncome = [] } = useOtherIncome();
  const { data: allAccountPayments = [] } = useCurrentAccountPayments();
  const createOtherIncome = useCreateOtherIncome();
  const deleteOtherIncome = useDeleteOtherIncome();
  const { data: allContributions = [] } = useCashContributions();
  const createContribution = useCreateCashContribution();
  const deleteContribution = useDeleteCashContribution();
  const { data: allSessions = [] } = useCashSessions();
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();
  const reopenSession = useReopenCashSession();

  const { profileName, currentRole } = useAppRole();
  const { user } = useAuth();
  const author = { id: user?.id, name: profileName || user?.email || undefined };

  const canClose = currentRole === 'admin' || currentRole === 'reception';
  const canReopen = currentRole === 'admin';

  // La sesión en curso (sin cerrar) — solo puede haber una a la vez.
  const openTurn = allSessions.find((s) => !s.closedAt);

  // Sesión que se está mirando: la abierta si hay, si no la más reciente cerrada.
  // El usuario puede elegir ver un turno anterior.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const viewedSession = selectedId
    ? allSessions.find((s) => s.id === selectedId)
    : (openTurn ?? allSessions[0] ?? null);

  const { start: rangeStart, end: rangeEnd } = viewedSession
    ? sessionDateRange(viewedSession)
    : { start: '', end: '' };

  // ─── Formulario de apertura ───────────────────────────────────────────
  const [openingInput, setOpeningInput] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [newIncome, setNewIncome] = useState<{ description: string; method: PaymentMethod; amount: string }>(
    { description: '', method: 'CASH', amount: '' }
  );
  const [newAporte, setNewAporte] = useState<{ notes: string; amount: string }>({ notes: '', amount: '' });

  // ─── Movimientos del turno ────────────────────────────────────────────
  const otherIncomeSession = useMemo(
    () => allOtherIncome.filter((o) => belongsToSession(formatLocalDate(new Date(o.date)), rangeStart, rangeEnd)),
    [allOtherIncome, rangeStart, rangeEnd]
  );

  const accountPaymentsSession = useMemo(
    () => allAccountPayments.filter((p) => belongsToSession(formatLocalDate(new Date(p.date)), rangeStart, rangeEnd)),
    [allAccountPayments, rangeStart, rangeEnd]
  );

  const { byMethod, totalIngresos, cashTotal, aCuentaCorriente } = useMemo(() => {
    const byMethod: Record<string, number> = {};
    for (const m of PAYMENT_METHODS) byMethod[m.value] = 0;
    let total = 0;
    let aCuentaCorriente = 0;

    for (const p of payments) {
      if (p.status !== 'PAID' || !belongsToSession(formatLocalDate(new Date(p.date)), rangeStart, rangeEnd)) continue;
      if (isCurrentAccountPayment(p)) {
        aCuentaCorriente += p.amount;
        continue;
      }
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }
    for (const o of otherIncomeSession) {
      byMethod[o.method] = (byMethod[o.method] || 0) + o.amount;
      total += o.amount;
    }
    for (const p of accountPaymentsSession) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }

    return { byMethod, totalIngresos: total, cashTotal: byMethod['CASH'] || 0, aCuentaCorriente };
  }, [payments, otherIncomeSession, accountPaymentsSession, rangeStart, rangeEnd]);

  const { data: allExpenses = [] } = useExpenses();
  const expenses = useMemo(() => {
    const list = allExpenses
      .filter((e) => belongsToSession(formatLocalDate(new Date(e.date)), rangeStart, rangeEnd))
      .sort((a, b) => b.amount - a.amount);
    return { list, ...summarizeExpenses(list) };
  }, [allExpenses, rangeStart, rangeEnd]);

  const deuda = useMemo(() => {
    const rows: { name: string; room: string; owed: number }[] = [];
    let total = 0;
    for (const b of bookings) {
      const d = formatLocalDate(new Date(b.checkInDate));
      if (!belongsToSession(d, rangeStart, rangeEnd)) continue;
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
  }, [bookings, payments, guests, rooms, rangeStart, rangeEnd]);

  const cashFloat = viewedSession?.openingAmount ?? 0;
  const cashToDeposit = computeCashToDeposit({
    cashIncome: cashTotal,
    cashFloat,
    cashExpenses: expenses.cashRecaudacion,
  });
  const totalDelDia = totalIngresos - expenses.total;

  const aportesSesion = useMemo(
    () => allContributions.filter((c) => belongsToSession(formatLocalDate(new Date(c.date)), rangeStart, rangeEnd)),
    [allContributions, rangeStart, rangeEnd]
  );
  const aportesSesionTotal = aportesSesion.reduce((sum, c) => sum + c.amount, 0);
  const saldoEmpresa = useMemo(
    () => companyCashBalance(allContributions, allExpenses),
    [allContributions, allExpenses]
  );

  // Deriva del snapshot: si algo cambió después de cerrar, se ve aquí.
  const drift = useMemo(() => {
    if (!viewedSession?.closedAt) return [];
    const diffs: { label: string; saved: number; now: number }[] = [];
    const check = (label: string, saved: number | undefined, now: number) => {
      if (saved != null && Math.round(saved) !== Math.round(now)) diffs.push({ label, saved, now });
    };
    check('Efectivo cobrado', viewedSession.snapCashIncome, cashTotal);
    check('Efectivo a rendir', viewedSession.snapCashToDeposit, cashToDeposit);
    check('Total ingresos', viewedSession.snapTotalIncome, totalIngresos);
    check('Total gastos', viewedSession.snapTotalExpenses, expenses.total);
    return diffs;
  }, [viewedSession, cashTotal, cashToDeposit, totalIngresos, expenses.total]);

<<<<<<< HEAD
  const author = { id: user?.id, name: profileName || user?.email || undefined };

  // ─── El cierre del día ──────────────────────────────────────────────
  const { data: allClosings = [] } = useCashClosings();
  const closeDay = useCloseCashDay();
  const reopenDay = useReopenCashDay();
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  const closing = closingForDay(allClosings, day);
  const closed = isDayClosed(closing);
  const canClose = currentRole === 'admin' || currentRole === 'reception';
  const canReopen = currentRole === 'admin';

  // Lo que se cerró contra lo que dan los números ahora. Con algo acá, alguien
  // tocó un movimiento después de cerrar y lo rendido ya no coincide.
  const drift = useMemo(
    () => (closing && closed
      ? closingDrift(closing, {
          cashIncome: cashTotal,
          cashExpenses: expenses.cashRecaudacion,
          cashToDeposit,
          totalIncome: totalIngresos,
          totalExpenses: expenses.total,
        })
      : []),
    [closing, closed, cashTotal, expenses.cashRecaudacion, expenses.total, cashToDeposit, totalIngresos]
  );

  // Los últimos 7 días cerrables, hoy afuera: el cierre es del día que ya pasó.
  const ultimosDias = useMemo(() => {
    const dias: { dia: string; etiqueta: string; cerrado: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = defaultClosingDay();
      d.setDate(d.getDate() - i);
      const dia = formatLocalDate(d);
      dias.push({
        dia,
        etiqueta: format(d, 'EEE d/M', { locale: es }),
        cerrado: isDayClosed(closingForDay(allClosings, dia)),
=======
  // ─── Acciones ─────────────────────────────────────────────────────────
  const handleOpen = async () => {
    const amount = Number(openingInput) || 0;
    try {
      await openSession.mutateAsync({
        openingAmount: amount,
        openedBy: author.id,
        openedByName: author.name,
>>>>>>> b3be821 (feat(caja): apertura y cierre manual de turno en vez de día calendario)
      });
      setOpeningInput('');
      toast({ title: '✅ Caja abierta', description: `Saldo inicial: ${money(amount)}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo abrir la caja', variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    if (!openTurn) return;
    try {
      await closeSession.mutateAsync({
        sessionId: openTurn.id,
        closedBy: author.id,
        closedByName: author.name,
        notes: closeNotes,
        snapCashIncome: cashTotal,
        snapCashExpenses: expenses.cashRecaudacion,
        snapCashToDeposit: cashToDeposit,
        snapTotalIncome: totalIngresos,
        snapTotalExpenses: expenses.total,
      });
      setCloseNotes('');
      setConfirmClose(false);
      toast({ title: '🔒 Caja cerrada', description: `A rendir: ${money(cashToDeposit)}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo cerrar la caja', variant: 'destructive' });
    }
  };

  const handleReopen = async () => {
    if (!viewedSession?.closedAt) return;
    try {
      await reopenSession.mutateAsync({ sessionId: viewedSession.id });
      toast({ title: 'Caja reabierta', description: 'El turno volvió a estar abierto' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo reabrir. Solo administración puede.', variant: 'destructive' });
    }
  };

  const addOtherIncome = async () => {
    const amount = Number(newIncome.amount);
    if (!newIncome.description.trim() || !amount || amount <= 0) {
      toast({ title: 'Datos incompletos', description: 'Ingresá descripción y monto válido', variant: 'destructive' });
      return;
    }
    // El ingreso se carga en el día de apertura del turno (o hoy si sigue abierto)
    const incomeDate = viewedSession
      ? new Date(viewedSession.openedAt.toDateString())
      : new Date();
    try {
      await createOtherIncome.mutateAsync({
        date: incomeDate,
        description: newIncome.description.trim(),
        method: newIncome.method,
        amount,
      });
      setNewIncome({ description: '', method: 'CASH', amount: '' });
      toast({ title: 'Ingreso registrado', description: `${money(amount)} — ${newIncome.description.trim()}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo registrar el ingreso', variant: 'destructive' });
    }
  };

  const addAporte = async () => {
    const amount = Number(newAporte.amount);
    if (!amount || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresá cuánto puso la empresa', variant: 'destructive' });
      return;
    }
    const aporteDate = viewedSession
      ? new Date(viewedSession.openedAt.toDateString())
      : new Date();
    try {
      await createContribution.mutateAsync({
        date: aporteDate,
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

  // ─── Etiquetas de un turno para la lista ──────────────────────────────
  const sessionLabel = (s: typeof allSessions[number]) => {
    const open = format(s.openedAt, "EEE d/M HH:mm", { locale: es });
    if (!s.closedAt) return `${open} → en curso`;
    const close = format(s.closedAt, "HH:mm", { locale: es });
    const closeDate = format(s.closedAt, "d/M", { locale: es });
    const sameDay = formatLocalDate(s.openedAt) === formatLocalDate(s.closedAt);
    return `${open} → ${sameDay ? close : `${closeDate} ${close}`}`;
  };

  // ─── Imprimir ─────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!viewedSession) return;
    const w = window.open('', '', 'width=800,height=600');
    if (!w) return;
    const h = escapeHtml;
    const openLabel = format(viewedSession.openedAt, "EEEE d 'de' MMMM 'de' yyyy HH:mm", { locale: es });
    const closeLabel = viewedSession.closedAt
      ? format(viewedSession.closedAt, "EEEE d 'de' MMMM 'de' yyyy HH:mm", { locale: es })
      : 'turno abierto';
    const methodRows = PAYMENT_METHODS.map(
      (m) => `<tr><td>${h(m.label)}</td><td class="num">${money(byMethod[m.value] || 0)}</td></tr>`
    ).join('');
    const expenseTypeRows = Object.entries(expenses.byType)
      .map(([t, v]) => `<tr><td>${h(EXPENSE_TYPE_LABELS[t] || t)}</td><td class="num">${money(v)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    const expenseMethodRows = EXPENSE_METHOD_ORDER
      .filter((m) => expenses.byMethod[m])
      .map((m) => `<tr><td>${h(PAYMENT_METHOD_LABELS[m] || m)}</td><td class="num">${money(expenses.byMethod[m])}</td></tr>`)
      .join('')
      + (expenses.unspecified > 0
        ? `<tr><td>Sin especificar</td><td class="num">${money(expenses.unspecified)}</td></tr>` : '')
      || '<tr><td colspan="2">Sin gastos</td></tr>';
    const cajaLabel = (e: typeof expenses.list[number]) =>
      e.method !== 'CASH' ? '' : ` · ${(e.cashSource ?? 'RECAUDACION') === 'EMPRESA' ? 'caja empresa' : 'recaudación'}`;
    const expenseDetailRows = expenses.list
      .map((e) => `<tr><td>${h(EXPENSE_TYPE_LABELS[e.expenseType] || e.expenseType)}${e.description ? ` — ${h(e.description)}` : ''}<br><span class="muted">${h((e.method ? PAYMENT_METHOD_LABELS[e.method] || e.method : 'sin especificar') + cajaLabel(e))}</span></td><td class="num">${money(e.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    const aporteRows = aportesSesion
      .map((c) => `<tr><td>${h(c.notes || 'Aporte a la caja')}${c.createdByName ? `<br><span class="muted">${h(c.createdByName)}</span>` : ''}</td><td class="num">${money(c.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin aportes este turno</td></tr>';
    const deudaRows = deuda.rows
      .map((r) => `<tr><td>${h(r.name)} — Hab. ${h(r.room)}</td><td class="num">${money(r.owed)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin deudas</td></tr>';
    const otherIncomeRows = otherIncomeSession
      .map((o) => `<tr><td>${h(o.description)} (${h(PAYMENT_METHODS.find(m => m.value === o.method)?.label || o.method)})</td><td class="num">${money(o.amount)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin ingresos externos</td></tr>';
    w.document.write(`<!DOCTYPE html><html><head><title>Cierre de Caja</title>
    ${PRINT_FONT_LINK}
    <style>
      ${PRINT_FONT_CSS}
      body{max-width:720px;margin:0 auto;padding:32px;color:#1e293b}
      h1{font-size:20px;color:#003366;margin:0}.sub{color:#64748b;font-size:13px;margin-bottom:20px}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#003366;border-bottom:2px solid #D4A017;padding-bottom:4px;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .muted{color:#94a3b8;font-size:11px}
      .tot{font-weight:700;border-top:2px solid #1e293b}
      .grand{font-size:16px;font-weight:700;color:#003366}
    </style></head><body>
    <h1>Cierre de Caja — ${h(hotelSettings?.hotelName || 'Hotel')}</h1>
    <div class="sub">Apertura: <strong class="capitalize">${h(openLabel)}</strong><br>Cierre: <strong class="capitalize">${h(closeLabel)}</strong></div>
    <h2>Ingresos por método</h2><table>${methodRows}
      <tr class="tot"><td>Total ingresos</td><td class="num">${money(totalIngresos)}</td></tr>
      ${aCuentaCorriente > 0 ? `<tr><td>A cuenta corriente (no ingresó)</td><td class="num">${money(aCuentaCorriente)}</td></tr>` : ''}</table>
    <h2>Caja (efectivo)</h2><table>
      <tr><td>Efectivo cobrado</td><td class="num">${money(cashTotal)}</td></tr>
      <tr><td>Menos saldo inicial</td><td class="num">-${money(cashFloat)}</td></tr>
      <tr><td>Menos gastos pagados de la recaudación</td><td class="num">-${money(expenses.cashRecaudacion)}</td></tr>
      <tr class="tot"><td>Efectivo a rendir</td><td class="num">${money(cashToDeposit)}</td></tr></table>
    <h2>Gastos por rubro</h2><table>${expenseTypeRows}
      <tr class="tot"><td>Total gastos</td><td class="num">${money(expenses.total)}</td></tr></table>
    <h2>Gastos por cuenta</h2><table>${expenseMethodRows}</table>
    <h2>Detalle de gastos</h2><table>${expenseDetailRows}</table>
    <h2>Caja de la empresa</h2><table>
      <tr><td>Aportes de este turno</td><td class="num">${money(aportesSesionTotal)}</td></tr>
      <tr><td>Gastado de esta caja</td><td class="num">-${money(expenses.cashEmpresa)}</td></tr>
      <tr class="tot"><td>Saldo disponible</td><td class="num">${money(saldoEmpresa)}</td></tr></table>
    <table>${aporteRows}</table>
    <h2>Ingresos externos</h2><table>${otherIncomeRows}</table>
    <h2>Deudas (DEBE)</h2><table>${deudaRows}
      <tr class="tot"><td>Total deuda</td><td class="num">${money(deuda.total)}</td></tr></table>
    <h2>Resultado del turno</h2><table>
      <tr class="tot grand"><td>Total del turno (ingresos − gastos)</td><td class="num">${money(totalDelDia)}</td></tr></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [byMethod, expenses, deuda, otherIncomeSession, aCuentaCorriente, cashFloat, cashTotal, cashToDeposit, totalIngresos, totalDelDia, hotelSettings, aportesSesion, aportesSesionTotal, saldoEmpresa, viewedSession]);

  // ─── Render ───────────────────────────────────────────────────────────
  const isClosed = !!viewedSession?.closedAt;
  const isViewingOpen = viewedSession && !viewedSession.closedAt;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre de Caja"
        description="Abrí el turno con el saldo inicial en cajón, registrá los movimientos y cerralo cuando termines."
        actions={
          <>
            {viewedSession && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir cierre
              </Button>
            )}
            {isViewingOpen && canClose && (
              <Button size="sm" onClick={() => setConfirmClose(true)} disabled={closeSession.isPending}>
                <Lock className="w-4 h-4 mr-2" /> Cerrar caja
              </Button>
            )}
          </>
        }
      />

      {/* ── Apertura de caja ── */}
      {!openTurn && canClose && (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-600" /> Abrir caja
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Contá cuánto hay en el cajón ahora e ingresalo como saldo inicial. Eso es lo que
              queda en la caja para el próximo turno y no se rinde.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[200px]">
                <Label className="text-xs mb-1 block">Saldo inicial en cajón</Label>
                <Input
                  type="number" min={0} step={1000} placeholder="Ej: 10000"
                  value={openingInput}
                  onChange={(e) => setOpeningInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
                />
              </div>
              <Button onClick={handleOpen} disabled={openSession.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Play className="w-4 h-4 mr-2" /> Abrir turno
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lista de turnos recientes ── */}
      {allSessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allSessions.slice(0, 8).map((s) => {
            const isViewed = viewedSession?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id === (openTurn?.id ?? allSessions[0]?.id) ? null : s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors',
                  isViewed
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border hover:bg-muted/60',
                  s.closedAt ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                )}
              >
                {s.closedAt ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                <span className="capitalize">{sessionLabel(s)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Estado del turno visto ── */}
      {viewedSession && isClosed ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30 p-4">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Caja cerrada — se rindieron {money(viewedSession.snapCashToDeposit ?? cashToDeposit)}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {viewedSession.closedByName ? `${viewedSession.closedByName} · ` : ''}
              {format(viewedSession.closedAt!, "d 'de' MMMM, HH:mm", { locale: es })}
              {viewedSession.notes ? ` · ${viewedSession.notes}` : ''}
            </p>
          </div>
          {canReopen && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={reopenSession.isPending}>
              <LockOpen className="w-4 h-4 mr-2" /> Reabrir
            </Button>
          )}
        </div>
      ) : viewedSession && !isClosed ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-4">
          <LockOpen className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Caja abierta · saldo inicial {money(viewedSession.openingAmount)}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              {viewedSession.openedByName ? `${viewedSession.openedByName} · ` : ''}
              Desde {format(viewedSession.openedAt, "d 'de' MMMM, HH:mm", { locale: es })}
              {rangeStart !== rangeEnd ? ` hasta hoy` : ''}
            </p>
          </div>
        </div>
      ) : null}

      {/* Alguien tocó algo después de cerrar */}
      {drift.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Se modificó algo después de cerrar
          </p>
          <div className="space-y-1">
            {drift.map((d) => (
              <div key={d.label} className="flex justify-between text-xs text-rose-800 dark:text-rose-200">
                <span>{d.label}</span>
                <span className="tabular-nums">
                  <span className="line-through opacity-70">{money(d.saved)}</span>
                  {' → '}
                  <strong>{money(d.now)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sin sesión para ver */}
      {!viewedSession && (
        <p className="text-sm text-muted-foreground text-center py-12">
          No hay turnos registrados aún. Abrí la caja para empezar.
        </p>
      )}

      {/* ── Cuerpo del turno ── */}
      {viewedSession && (
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
              {aCuentaCorriente > 0 && (
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-muted-foreground">A cuenta corriente (no ingresó)</span>
                  <span className="text-amber-600 dark:text-amber-400 tabular-nums">{money(aCuentaCorriente)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Caja / efectivo a rendir */}
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader><CardTitle className="text-base">Caja (efectivo)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Efectivo cobrado</span>
                <span className="font-medium tabular-nums">{money(cashTotal)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Menos saldo inicial</span>
                <span className="font-medium tabular-nums text-rose-500">-{money(cashFloat)}</span>
              </div>
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
                  Se gastó más efectivo del que entró: la diferencia salió del saldo inicial.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Gastos */}
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Gastos del turno</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {expenses.list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin gastos registrados en este turno</p>
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
                      {expenses.unspecified > 0 && (
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-amber-600 dark:text-amber-400">Sin especificar</span>
                          <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{money(expenses.unspecified)}</span>
                        </div>
                      )}
                    </div>
                  </div>
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
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Total gastos</span>
                <span className="text-rose-600 tabular-nums">{money(expenses.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Deudas */}
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader><CardTitle className="text-base">Deudas del turno (DEBE)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {deuda.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin deudas registradas en este turno</p>
              ) : (
                deuda.rows.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-muted-foreground">{r.name} — Hab. {r.room}</span>
                    <span className="font-medium tabular-nums text-amber-600">{money(r.owed)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Total deuda</span>
                <span className="text-amber-600 tabular-nums">{money(deuda.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Caja de la empresa */}
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Caja de la empresa</CardTitle>
              <p className="text-xs text-muted-foreground">
                Efectivo que pone el hotel para las compras. No es un ingreso y no se rinde.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Aportes de este turno</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">{money(aportesSesionTotal)}</p>
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
              {aportesSesion.length > 0 && (
                <div>
                  {aportesSesion.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <span className="text-muted-foreground flex-1">{c.notes || 'Aporte a la caja'}</span>
                      <span className="text-xs text-slate-400 mr-3">{c.createdByName || ''}</span>
                      <span className="font-medium tabular-nums mr-2">{money(c.amount)}</span>
                      {!isClosed && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteContribution.mutate(c)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isClosed && (
                <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                  <div className="flex-1 min-w-[160px]">
                    <Label className="text-xs mb-1 block">Detalle (opcional)</Label>
                    <Input value={newAporte.notes} onChange={(e) => setNewAporte((p) => ({ ...p, notes: e.target.value }))} placeholder="Ej: reposición para compras" />
                  </div>
                  <div className="w-[140px]">
                    <Label className="text-xs mb-1 block">Monto</Label>
                    <Input type="number" min={0} value={newAporte.amount} onChange={(e) => setNewAporte((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <Button onClick={addAporte} disabled={createContribution.isPending}>
                    <Plus className="w-4 h-4 mr-1" /> Registrar aporte
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingresos externos */}
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Ingresos externos / adicionales</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {otherIncomeSession.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ingresos externos en este turno</p>
              ) : (
                otherIncomeSession.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-muted-foreground flex-1">{o.description}</span>
                    <span className="text-xs text-slate-400 mr-3">{PAYMENT_METHODS.find(m => m.value === o.method)?.label || o.method}</span>
                    <span className="font-medium tabular-nums mr-2">{money(o.amount)}</span>
                    {!isClosed && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteOtherIncome.mutate(o.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              )}
              {!isClosed && (
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
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultado del turno */}
      {viewedSession && (
        <Card className="brass-top lift glass border-none overflow-hidden">
          <CardContent className="p-7 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total del turno · ingresos − gastos</p>
              <p className="num-display text-5xl font-semibold text-primary dark:text-accent mt-2">{money(totalDelDia)}</p>
            </div>
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
              <Wallet className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmar el cierre */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la caja?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Se guarda el corte con los números de ahora:</p>
                <div className="rounded-xl border bg-muted/40 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Efectivo cobrado</span><span className="tabular-nums">{money(cashTotal)}</span></div>
                  <div className="flex justify-between"><span>Menos saldo inicial</span><span className="tabular-nums">-{money(cashFloat)}</span></div>
                  <div className="flex justify-between"><span>Menos gastos del cajón</span><span className="tabular-nums">-{money(expenses.cashRecaudacion)}</span></div>
                  <div className="flex justify-between pt-1 border-t font-semibold">
                    <span>Efectivo a rendir</span><span className="tabular-nums">{money(cashToDeposit)}</span>
                  </div>
                </div>
                {expenses.unspecified > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Hay {money(expenses.unspecified)} en gastos sin especificar con qué se pagaron.
                    Si alguno salió del cajón, el efectivo a rendir está dando de más.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Observaciones (opcional)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Diferencia de $500, faltó el ticket del panadero..."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={closeSession.isPending}>
              <Lock className="w-4 h-4 mr-2" /> Cerrar la caja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
