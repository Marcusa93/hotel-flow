import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useExpenses } from '@/hooks/useExpenses';
import { useOtherIncome } from '@/hooks/useOtherIncome';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAYMENT_METHODS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { escapeHtml } from '@/lib/utils';

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

export default function BalanceMensual() {
  const { payments } = usePaymentOperations();
  const { data: allExpenses = [] } = useExpenses();
  const { data: allOtherIncome = [] } = useOtherIncome();
  const { data: hotelSettings } = useHotelSettings();

  // Month as "YYYY-MM"
  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const monthStart = useMemo(() => startOfMonth(new Date(month + '-01T00:00:00')), [month]);
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const inMonth = (d: Date) => d >= monthStart && d <= monthEnd;

  const income = useMemo(() => {
    const byMethod: Record<string, number> = {};
    for (const m of PAYMENT_METHODS) byMethod[m.value] = 0;
    let total = 0;
    for (const p of payments) {
      if (p.status !== 'PAID' || !inMonth(new Date(p.date))) continue;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }
    for (const o of allOtherIncome) {
      if (!inMonth(new Date(o.date))) continue;
      byMethod[o.method] = (byMethod[o.method] || 0) + o.amount;
      total += o.amount;
    }
    return { byMethod, total };
  }, [payments, allOtherIncome, monthStart, monthEnd]);

  const expenses = useMemo(() => {
    const byType: Record<string, number> = {};
    let total = 0;
    for (const e of allExpenses) {
      if (!inMonth(new Date(e.date))) continue;
      byType[e.expenseType] = (byType[e.expenseType] || 0) + e.amount;
      total += e.amount;
    }
    return { byType, total };
  }, [allExpenses, monthStart, monthEnd]);

  const totalFinal = income.total - expenses.total;
  const monthLabel = format(monthStart, "MMMM 'de' yyyy", { locale: es });

  const handlePrint = useCallback(() => {
    const w = window.open('', '', 'width=800,height=600');
    if (!w) return;
    const h = escapeHtml;
    const incomeRows = PAYMENT_METHODS.map(
      (m) => `<tr><td>${h(m.label)}</td><td class="num">${money(income.byMethod[m.value] || 0)}</td></tr>`
    ).join('');
    const expenseRows = Object.entries(expenses.byType)
      .map(([t, v]) => `<tr><td>${h(EXPENSE_TYPE_LABELS[t] || t)}</td><td class="num">${money(v)}</td></tr>`)
      .join('') || '<tr><td colspan="2">Sin gastos</td></tr>';
    w.document.write(`<!DOCTYPE html><html><head><title>Balance ${h(month)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,sans-serif;max-width:720px;margin:0 auto;padding:32px;color:#1e293b}
      h1{font-size:20px;color:#003366;margin:0}.sub{color:#64748b;font-size:13px;margin-bottom:20px;text-transform:capitalize}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#003366;border-bottom:2px solid #D4A017;padding-bottom:4px;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .num{text-align:right;font-variant-numeric:tabular-nums}.tot{font-weight:700;border-top:2px solid #1e293b}
      .grand{font-size:16px;font-weight:700;color:#003366}
    </style></head><body>
    <h1>Balance Mensual — ${h(hotelSettings?.hotelName || 'Hotel')}</h1>
    <div class="sub">${h(monthLabel)}</div>
    <h2>Ingresos por método</h2><table>${incomeRows}
      <tr class="tot"><td>Total ingreso</td><td class="num">${money(income.total)}</td></tr></table>
    <h2>Gastos por categoría</h2><table>${expenseRows}
      <tr class="tot"><td>Total gasto</td><td class="num">${money(expenses.total)}</td></tr></table>
    <h2>Resultado</h2><table>
      <tr class="tot grand"><td>Total final (ingreso − gasto)</td><td class="num">${money(totalFinal)}</td></tr></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [income, expenses, month, monthLabel, totalFinal, hotelSettings]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Mensual"
        description="Ingresos por método, gastos por categoría y resultado del mes"
        actions={
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir balance
          </Button>
        }
      />

      <div className="flex items-end gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-sm">
        <div>
          <Label className="text-xs mb-1 block">Mes</Label>
          <Input type="month" value={month} max={format(new Date(), 'yyyy-MM')} onChange={(e) => setMonth(e.target.value)} className="w-[180px]" />
        </div>
        <p className="text-sm text-muted-foreground capitalize ml-auto">{monthLabel}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ingresos */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Ingresos por método</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.value} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium tabular-nums">{money(income.byMethod[m.value] || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total ingreso</span><span className="text-emerald-600 tabular-nums">{money(income.total)}</span></div>
          </CardContent>
        </Card>

        {/* Gastos */}
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /> Gastos por categoría</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(expenses.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin gastos registrados este mes</p>
            ) : (
              Object.entries(expenses.byType).map(([t, v]) => (
                <div key={t} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-muted-foreground">{EXPENSE_TYPE_LABELS[t] || t}</span>
                  <span className="font-medium tabular-nums">{money(v)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-2 border-t font-bold"><span>Total gasto</span><span className="text-rose-600 tabular-nums">{money(expenses.total)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Total final */}
      <Card className="brass-top lift glass border-none overflow-hidden">
        <CardContent className="p-7 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total final · ingreso − gasto</p>
            <p className={`num-display text-5xl font-semibold mt-2 ${totalFinal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{money(totalFinal)}</p>
          </div>
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${totalFinal >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            <Scale className={`w-8 h-8 ${totalFinal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
