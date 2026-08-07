import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Printer,
  TrendingUp,
  TrendingDown,
  Scale,
  BedDouble,
  Wallet,
  Building2,
} from 'lucide-react';
import { useMonthlySummary, type MonthlyMovements } from '@/hooks/useMonthlySummary';
import { useExpenses } from '@/hooks/useExpenses';
import { useCompanyCashBalance } from '@/hooks/useCompanyCashBalance';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import {
  summarizeMonthIncome,
  monthOccupancy,
  occupancyByRoomType,
  monthRange,
} from '@/lib/monthlySummary';
import { summarizeExpenses, EXPENSE_METHOD_ORDER } from '@/lib/cashClosing';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';
import { cn, escapeHtml, formatLocalDate } from '@/lib/utils';
import { PRINT_FONT_LINK, PRINT_FONT_CSS } from '@/lib/printStyles';

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
const pct = (n: number) => `${n.toFixed(0)}%`;

/**
 * El mes vacío mientras carga. Es una constante y no un `?? []` suelto porque
 * ese literal es un array nuevo en cada render: los useMemo de abajo lo verían
 * cambiar siempre y recalcularían el mes entero al pedo.
 */
const SIN_DATOS: MonthlyMovements = {
  payments: [],
  otherIncome: [],
  accountPayments: [],
  bookings: [],
};

export default function BalanceMensual() {
  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  const range = useMemo(() => monthRange(month), [month]);
  const { data: movements, isLoading } = useMonthlySummary(month);
  const { data: monthExpenses = [] } = useExpenses({
    startDate: range.start,
    endDate: range.monthEnd,
  });
  const { rooms, roomTypes } = useRoomOperations();
  const { data: hotelSettings } = useHotelSettings();

  const { payments, otherIncome, accountPayments, bookings } = movements ?? SIN_DATOS;

  /* ─────────────────────────── Plata ─────────────────────────── */

  const income = useMemo(
    () => summarizeMonthIncome({ payments, otherIncome, accountPayments }),
    [payments, otherIncome, accountPayments]
  );

  const expenses = useMemo(() => summarizeExpenses(monthExpenses), [monthExpenses]);

  const resultado = income.total - expenses.total;

  // El saldo de la caja de la empresa: lo recaudado desde siempre menos lo
  // gastado. Viene de la base y no se suma acá — es un acumulado sin recorte de
  // fecha y PostgREST corta en mil filas. Ver useCompanyCashBalance.
  const { data: saldoEmpresa } = useCompanyCashBalance();

  /* ───────────────────────── Ocupación ───────────────────────── */

  const occupancy = useMemo(
    () =>
      monthOccupancy({
        bookings,
        // Todas las habitaciones, sin mirar el estado de hoy: que una esté en
        // mantenimiento esta semana no significa que lo estuviera en el mes que
        // se está mirando, y descontarla cambiaría la ocupación de meses viejos.
        roomCount: rooms.length,
        start: range.start,
        end: range.end,
      }),
    [bookings, rooms.length, range.start, range.end]
  );

  const byType = useMemo(
    () => occupancyByRoomType({ bookings, rooms, roomTypes, start: range.start, end: range.end }),
    [bookings, rooms, roomTypes, range.start, range.end]
  );

  const occupancyChart = useMemo(
    () => occupancy.byDay.map(d => ({ dia: format(d.date, 'd'), ocupadas: d.occupied })),
    [occupancy.byDay]
  );

  const monthLabel = format(range.start, "MMMM 'de' yyyy", { locale: es });
  const hotelName = hotelSettings?.hotelName || 'Hotel';
  const periodNote = range.isPartial
    ? `Del 1 al ${format(range.end, 'd')} — el mes todavía no terminó`
    : `Mes completo — ${occupancy.daysCounted} días`;

  /* ─────────────────────────── Imprimir ─────────────────────────── */

  const handlePrint = useCallback(() => {
    const w = window.open('', '', 'width=800,height=600');
    if (!w) return;
    const h = escapeHtml;

    const incomeRows = PAYMENT_METHODS.filter(m => income.byMethod[m.value])
      .map(m => `<tr><td>${h(m.label)}</td><td class="num">${money(income.byMethod[m.value])}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin ingresos</td></tr>';

    const expenseTypeRows = Object.entries(expenses.byType)
      .map(([t, v]) => `<tr><td>${h(EXPENSE_TYPE_LABELS[t] || t)}</td><td class="num">${money(v)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';

    const expenseMethodRows = EXPENSE_METHOD_ORDER.filter(m => expenses.byMethod[m])
      .map(m => `<tr><td>${h(PAYMENT_METHOD_LABELS[m] || m)}</td><td class="num">${money(expenses.byMethod[m])}</td></tr>`)
      .join('')
      + (expenses.unspecified > 0
        ? `<tr><td>Sin especificar</td><td class="num">${money(expenses.unspecified)}</td></tr>`
        : '')
      || '<tr><td colspan="2">Sin gastos</td></tr>';

    const typeRows = byType
      .map(t => `<tr><td>${h(t.label)} (${t.rooms} hab.)</td><td class="num">${pct(t.rate)} — ${t.nightsSold}/${t.nightsAvailable}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin habitaciones cargadas</td></tr>';

    w.document.write(`<!DOCTYPE html><html><head><title>Resumen ${h(month)}</title>
    ${PRINT_FONT_LINK}
    <style>
      ${PRINT_FONT_CSS}
      body{max-width:720px;margin:0 auto;padding:32px;color:#1e293b}
      h1{font-size:20px;color:#003366;margin:0}.sub{color:#64748b;font-size:13px;margin-bottom:20px;text-transform:capitalize}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#003366;border-bottom:2px solid #D4A017;padding-bottom:4px;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .num{text-align:right;font-variant-numeric:tabular-nums}.tot{font-weight:700;border-top:2px solid #1e293b}
      .grand{font-size:16px;font-weight:700;color:#003366}
      .muted{color:#94a3b8;font-size:11px}
    </style></head><body>
    <h1>Resumen del Mes — ${h(hotelName)}</h1>
    <div class="sub">${h(monthLabel)} · ${h(periodNote)}</div>

    <h2>Ocupación</h2><table>
      <tr><td>Ocupación del período</td><td class="num">${pct(occupancy.rate)}</td></tr>
      <tr><td>Noches vendidas</td><td class="num">${occupancy.nightsSold} de ${occupancy.nightsAvailable}</td></tr>
      ${occupancy.busiest ? `<tr><td>Día más lleno</td><td class="num">${format(occupancy.busiest.date, "d 'de' MMMM", { locale: es })} — ${occupancy.busiest.occupied} hab.</td></tr>` : ''}
      ${occupancy.quietest ? `<tr><td>Día más vacío</td><td class="num">${format(occupancy.quietest.date, "d 'de' MMMM", { locale: es })} — ${occupancy.quietest.occupied} hab.</td></tr>` : ''}
      ${occupancy.halfDays > 0 ? `<tr><td>Medias estadías <span class="muted">(no ocupan noche)</span></td><td class="num">${occupancy.halfDays}</td></tr>` : ''}
    </table>

    <h2>Ocupación por tipo</h2><table>${typeRows}</table>

    <h2>Ingresos por método</h2><table>${incomeRows}
      <tr class="tot"><td>Total que entró</td><td class="num">${money(income.total)}</td></tr>
      ${income.toAccounts > 0
        ? `<tr><td>Cargado a cuenta corriente <span class="muted">(no entró)</span></td><td class="num">${money(income.toAccounts)}</td></tr>`
        : ''}</table>

    <h2>De dónde vino</h2><table>
      <tr><td>Cobros de reservas</td><td class="num">${money(income.fromBookings)}</td></tr>
      <tr><td>Ingresos externos</td><td class="num">${money(income.fromOther)}</td></tr>
      <tr><td>Pagos de cuenta corriente</td><td class="num">${money(income.fromAccounts)}</td></tr></table>

    <h2>Gastos por rubro</h2><table>${expenseTypeRows}
      <tr class="tot"><td>Total gastos</td><td class="num">${money(expenses.total)}</td></tr></table>

    <h2>Gastos por cuenta</h2><table>${expenseMethodRows}</table>

    <h2>Caja de la empresa</h2><table>
      <tr><td>Pagado de esta caja en el mes</td><td class="num">${money(expenses.empresa)}</td></tr>
      <tr class="tot"><td>Saldo disponible hoy</td><td class="num">${saldoEmpresa == null ? '—' : money(saldoEmpresa)}</td></tr></table>

    <h2>Resultado</h2><table>
      <tr class="tot grand"><td>Resultado del mes (entró − gastos)</td><td class="num">${money(resultado)}</td></tr></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [income, expenses, byType, occupancy, saldoEmpresa, resultado, month, monthLabel, periodNote, hotelName]);

  /* ─────────────────────────── Pantalla ─────────────────────────── */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen del Mes"
        description="Cómo le fue al hotel: cuánta plata entró y salió, y cuán lleno estuvo."
        actions={
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir resumen
          </Button>
        }
      />

      <div className="flex items-end gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-sm">
        <div>
          <Label className="text-xs mb-1 block">Mes</Label>
          <Input
            type="month"
            value={month}
            max={format(new Date(), 'yyyy-MM')}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
          <p className="text-xs text-muted-foreground/80">{periodNote}</p>
        </div>
      </div>

      {/* Los cuatro números que resumen el mes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Entró
            </div>
            <p className="num-display text-2xl font-bold text-emerald-600 mt-2 tabular-nums">
              {money(income.total)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Gastos
            </div>
            <p className="num-display text-2xl font-bold text-rose-600 mt-2 tabular-nums">
              {money(expenses.total)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              <Scale className="w-3.5 h-3.5 text-primary" /> Resultado
            </div>
            <p className={cn(
              'num-display text-2xl font-bold mt-2 tabular-nums',
              resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {money(resultado)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              <BedDouble className="w-3.5 h-3.5 text-indigo-500" /> Ocupación
            </div>
            <p className="num-display text-2xl font-bold text-indigo-600 mt-2 tabular-nums">
              {pct(occupancy.rate)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {occupancy.nightsSold} de {occupancy.nightsAvailable} noches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ocupación día por día */}
      <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-indigo-500" /> Ocupación día por día
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Habitaciones ocupadas cada noche, sobre {rooms.length} del hotel. El día de salida no
            ocupa: esa mañana la habitación se puede vender de nuevo.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando el mes…</p>
          ) : occupancyChart.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin días para mostrar</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyChart}>
                  <CartesianGrid
                    strokeDasharray={chartGrid.strokeDasharray}
                    vertical={false}
                    stroke={chartGrid.stroke}
                    opacity={0.5}
                  />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={chartAxis.tick} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, rooms.length || 'auto']}
                    tick={chartAxis.tick}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value: number) => [`${value} habitaciones`, 'Ocupadas']}
                    labelFormatter={(label) => `Día ${label}`}
                    contentStyle={chartTooltip.contentStyle}
                  />
                  <Bar dataKey="ocupadas" fill={chartColors.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3 mt-4 pt-4 border-t">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Día más lleno
              </p>
              <p className="text-sm font-medium">
                {occupancy.busiest
                  ? `${format(occupancy.busiest.date, "d 'de' MMMM", { locale: es })} — ${occupancy.busiest.occupied} hab.`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Día más vacío
              </p>
              <p className="text-sm font-medium">
                {occupancy.quietest
                  ? `${format(occupancy.quietest.date, "d 'de' MMMM", { locale: es })} — ${occupancy.quietest.occupied} hab.`
                  : '—'}
              </p>
            </div>
            {occupancy.halfDays > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Medias estadías
                </p>
                <p className="text-sm font-medium">
                  {occupancy.halfDays}
                  <span className="text-muted-foreground font-normal"> — no ocupan noche</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ocupación por tipo */}
      {byType.length > 0 && (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ocupación por tipo de habitación</CardTitle>
            <p className="text-xs text-muted-foreground">
              Dice qué es lo que queda sin vender, que en el porcentaje del hotel entero no se ve.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {byType.map(t => (
              <div key={t.roomTypeId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.label} <span className="text-xs">({t.rooms} hab.)</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {pct(t.rate)}
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      {t.nightsSold}/{t.nightsAvailable} noches
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, t.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ingresos */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Ingresos por método
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PAYMENT_METHODS.map(m => (
              <div
                key={m.value}
                className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium tabular-nums">{money(income.byMethod[m.value] || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Total que entró</span>
              <span className="text-emerald-600 tabular-nums">{money(income.total)}</span>
            </div>

            {/* Abajo de la raya: es plata que el hotel todavía no vio */}
            {income.toAccounts > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted-foreground">Cargado a cuenta corriente (no entró)</span>
                <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                  {money(income.toAccounts)}
                </span>
              </div>
            )}

            <div className="pt-3 mt-1 border-t space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                De dónde vino
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cobros de reservas</span>
                <span className="tabular-nums">{money(income.fromBookings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos externos</span>
                <span className="tabular-nums">{money(income.fromOther)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagos de cuenta corriente</span>
                <span className="tabular-nums">{money(income.fromAccounts)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gastos */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" /> Gastos del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Por rubro
              </p>
              {Object.keys(expenses.byType).length === 0 ? (
                <p className="text-sm text-muted-foreground py-1">Sin gastos registrados este mes</p>
              ) : (
                Object.entries(expenses.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, v]) => (
                    <div
                      key={t}
                      className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <span className="text-muted-foreground">{EXPENSE_TYPE_LABELS[t] || t}</span>
                      <span className="font-medium tabular-nums">{money(v)}</span>
                    </div>
                  ))
              )}
            </div>

            {Object.keys(expenses.byMethod).length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                  Por cuenta
                </p>
                {EXPENSE_METHOD_ORDER.filter(m => expenses.byMethod[m]).map(m => (
                  <div
                    key={m}
                    className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[m] || m}</span>
                    <span className="font-medium tabular-nums">{money(expenses.byMethod[m])}</span>
                  </div>
                ))}
                {/* Los cargados antes de que se pidiera el medio de pago */}
                {expenses.unspecified > 0 && (
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-amber-600 dark:text-amber-400">Sin especificar</span>
                    <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                      {money(expenses.unspecified)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Total gastos</span>
              <span className="text-rose-600 tabular-nums">{money(expenses.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caja de la empresa — solo lo que se movió este mes */}
      <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-500" /> Caja de la empresa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Todo lo que el hotel recaudó desde siempre, menos todo lo que se gastó. Es de acá
            que salen los pagos grandes —luz, internet, supermercado—, y por eso no tocan la
            caja diaria de recepción. Recepción no ve ni este saldo ni esos gastos.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Saldo disponible hoy
            </p>
            <p
              className={cn(
                'num-display text-4xl font-semibold mt-1',
                saldoEmpresa != null && saldoEmpresa < 0
                  ? 'text-rose-600'
                  : 'text-slate-800 dark:text-slate-100'
              )}
            >
              {saldoEmpresa == null ? '—' : money(saldoEmpresa)}
            </p>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Pagado de esta caja en {monthLabel}</span>
            <span className="font-medium tabular-nums text-rose-600">{money(expenses.empresa)}</span>
          </div>
          {saldoEmpresa != null && saldoEmpresa < 0 && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Se gastó más de lo que el hotel recaudó. Si el número no es el esperado, revisá
              que no haya gastos cargados dos veces.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado del mes */}
      <Card className="brass-top lift glass border-none overflow-hidden">
        <CardContent className="p-7 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Resultado del mes · entró − gastos
            </p>
            <p
              className={`num-display text-5xl font-semibold mt-2 ${
                resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {money(resultado)}
            </p>
            {income.toAccounts > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No incluye {money(income.toAccounts)} cargados a cuenta corriente: esa plata todavía
                se debe.
              </p>
            )}
          </div>
          <div
            className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${
              resultado >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
            }`}
          >
            <Wallet className={`w-8 h-8 ${resultado >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
