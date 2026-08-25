import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  GuestMovement, MonthIncome, MonthOccupancy, TypeOccupancy,
} from '@/lib/monthlySummary';
import type { ExpenseBreakdown } from '@/lib/cashClosing';
import type { MinibarSummary } from '@/lib/heladera';
import { narrateMonth } from '@/lib/monthNarrative';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/constants';
import { EXPENSE_METHOD_ORDER } from '@/lib/cashClosing';

/**
 * El resumen del mes, en un PDF que se descarga.
 *
 * Existía como "Imprimir resumen" y abría el diálogo de impresión del navegador.
 * El contenido estaba bien, pero el dueño necesitaba un archivo para mandarle a
 * los socios — y lo único descargable que encontró fue el Excel de Estadísticas,
 * que trae la tabla cruda de reservas y cobros: todo lo que a un socio no le
 * dice nada.
 *
 * De ahí las decisiones de este documento. Arranca por los tres números que se
 * miran primero —entró, se gastó, quedó— y recién después abre el detalle. No
 * lista reservas ni cobros uno por uno: para eso está la pantalla.
 */

export interface MonthlySummaryPDFProps {
  hotelName: string;
  monthLabel: string;
  periodNote: string;
  income: MonthIncome;
  expenses: ExpenseBreakdown;
  occupancy: MonthOccupancy;
  byType: TypeOccupancy[];
  /** Cuánta gente pasó y cuánto se quedó. */
  guests: GuestMovement;
  /**
   * La heladera. Su plata NO se suma acá: ya está adentro de los cobros y de
   * los ingresos externos, y sumarla otra vez inflaría el mes.
   */
  minibar: MinibarSummary;
  /** Lo acumulado del hotel al día de hoy. Null mientras carga. */
  companyBalance?: number | null;
  result: number;
  /** El mes en curso todavía no terminó: cambia cómo se redacta el resumen. */
  isPartial: boolean;
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
const pct = (n: number) => `${n.toFixed(0)}%`;

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
  accentLine: { height: 3, backgroundColor: '#D4A017', marginBottom: 22, borderRadius: 2 },

  hotelName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#003366' },
  title: { fontSize: 12, color: '#334155', marginTop: 2, textTransform: 'capitalize' },
  period: { fontSize: 9, color: '#94a3b8', marginTop: 2 },

  // Los tres números de arriba. Es lo que se mira primero y lo único que muchos
  // van a mirar, así que va grande y antes que cualquier detalle.
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 22, marginBottom: 8 },
  kpi: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 12 },
  kpiLabel: { fontSize: 7.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 4 },

  sectionTitle: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#003366',
    textTransform: 'uppercase', letterSpacing: 0.6,
    borderBottomWidth: 1.5, borderBottomColor: '#D4A017',
    paddingBottom: 3, marginTop: 18, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9',
  },
  rowLabel: { color: '#475569', flex: 1 },
  rowValue: { fontFamily: 'Helvetica-Bold' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 5, marginTop: 3, borderTopWidth: 1.5, borderTopColor: '#1e293b',
  },
  totalLabel: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#94a3b8', fontSize: 8 },

  // El resumen escrito. Va ancho completo y con más interlínea que las tablas:
  // se lee como texto, no se escanea como una columna de números.
  narrative: { marginTop: 16 },
  paragraph: { fontSize: 9.5, lineHeight: 1.55, color: '#334155', marginBottom: 5 },

  attention: {
    marginTop: 10, padding: 10,
    backgroundColor: '#fffbeb', borderWidth: 0.75, borderColor: '#e2b53d', borderRadius: 5,
  },
  attentionTitle: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#92610a',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5,
  },
  attentionItem: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 9, color: '#92610a' },
  attentionText: { flex: 1, fontSize: 9, lineHeight: 1.45, color: '#3f2d0b' },

  twoCol: { flexDirection: 'row', gap: 22 },
  col: { flex: 1 },

  footer: {
    position: 'absolute', bottom: 28, left: 44, right: 44,
    fontSize: 7.5, color: '#94a3b8', textAlign: 'center',
    borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 6,
  },
});

const Row = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>
      {label}
      {hint ? <Text style={styles.muted}> {hint}</Text> : null}
    </Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const Total = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.totalRow}>
    <Text style={styles.totalLabel}>{label}</Text>
    <Text style={styles.totalLabel}>{value}</Text>
  </View>
);

export function MonthlySummaryPDF({
  hotelName, monthLabel, periodNote,
  income, expenses, occupancy, byType, guests, minibar, companyBalance, result, isPartial,
}: MonthlySummaryPDFProps) {
  /**
   * Cuánto se sacó por cada noche vendida.
   *
   * Es el número que dice si el mes se vendió bien, y el porcentaje de ocupación
   * solo no lo responde: un hotel lleno a mitad de precio y uno a medio llenar
   * al doble facturan lo mismo, y no son el mismo mes.
   *
   * Solo sobre los cobros de reservas: los ingresos externos —el alquiler del
   * salón— no salieron de vender una noche, y meterlos inflaría el promedio.
   */
  const tarifaPromedio = occupancy.nightsSold > 0
    ? Math.round(income.fromBookings / occupancy.nightsSold)
    : 0;

  const relato = narrateMonth({
    income, expenses, occupancy, byType, guests, minibar, result, isPartial,
  });

  const metodosConPlata = PAYMENT_METHODS.filter(m => income.byMethod[m.value]);
  const rubrosConGasto = Object.entries(expenses.byType).sort((a, b) => b[1] - a[1]);
  const cuentasConGasto = EXPENSE_METHOD_ORDER.filter(m => expenses.byMethod[m]);

  return (
    <Document title={`Resumen ${monthLabel} — ${hotelName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentLine} />

        <View>
          <Text style={styles.hotelName}>{hotelName}</Text>
          <Text style={styles.title}>Resumen de {monthLabel}</Text>
          <Text style={styles.period}>{periodNote}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Entró</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{money(income.total)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Gastos</Text>
            <Text style={[styles.kpiValue, { color: '#e11d48' }]}>{money(expenses.total)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Resultado</Text>
            <Text style={[styles.kpiValue, { color: result < 0 ? '#e11d48' : '#003366' }]}>
              {money(result)}
            </Text>
          </View>
        </View>

        <View style={styles.narrative}>
          <Text style={styles.sectionTitle}>Cómo fue el mes</Text>
          {[...relato.ocupacion, ...relato.plata].map((parrafo, i) => (
            <Text key={i} style={styles.paragraph}>{parrafo}</Text>
          ))}

          {relato.atencion.length > 0 && (
            <View style={styles.attention} wrap={false}>
              <Text style={styles.attentionTitle}>Para mirar</Text>
              {relato.atencion.map((aviso, i) => (
                <View key={i} style={styles.attentionItem}>
                  <Text style={styles.bullet}>—</Text>
                  <Text style={styles.attentionText}>{aviso}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.twoCol} wrap={false}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Ocupación</Text>
            <Row label="Del período" value={pct(occupancy.rate)} />
            <Row
              label="Noches vendidas"
              value={`${occupancy.nightsSold} de ${occupancy.nightsAvailable}`}
            />
            {tarifaPromedio > 0 && (
              <Row label="Promedio por noche" value={money(tarifaPromedio)} />
            )}
            {occupancy.busiest && (
              <Row
                label="Día más lleno"
                value={`${format(occupancy.busiest.date, "d 'de' MMM", { locale: es })} — ${occupancy.busiest.occupied} hab.`}
              />
            )}
            {occupancy.quietest && (
              <Row
                label="Día más vacío"
                value={`${format(occupancy.quietest.date, "d 'de' MMM", { locale: es })} — ${occupancy.quietest.occupied} hab.`}
              />
            )}
            {occupancy.halfDays > 0 && (
              <Row
                label="Medias estadías"
                hint="(no ocupan noche)"
                value={String(occupancy.halfDays)}
              />
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>De dónde vino la plata</Text>
            <Row label="Cobros de reservas" value={money(income.fromBookings)} />
            <Row label="Ingresos externos" value={money(income.fromOther)} />
            <Row label="Pagos de cuenta corriente" value={money(income.fromAccounts)} />
            <Total label="Total que entró" value={money(income.total)} />
            {income.toAccounts > 0 && (
              <Row
                label="Cargado a cuenta corriente"
                hint="(no entró)"
                value={money(income.toAccounts)}
              />
            )}
          </View>
        </View>

        <View style={styles.twoCol} wrap={false}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Cómo se cobró</Text>
            {metodosConPlata.length === 0 ? (
              <Row label="Sin ingresos en el período" value="—" />
            ) : (
              metodosConPlata.map(m => (
                <Row key={m.value} label={m.label} value={money(income.byMethod[m.value])} />
              ))
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Gastos por rubro</Text>
            {rubrosConGasto.length === 0 ? (
              <Row label="Sin gastos en el período" value="—" />
            ) : (
              rubrosConGasto.map(([tipo, monto]) => (
                <Row key={tipo} label={EXPENSE_TYPE_LABELS[tipo] || tipo} value={money(monto)} />
              ))
            )}
            <Total label="Total gastos" value={money(expenses.total)} />
          </View>
        </View>

        <View style={styles.twoCol} wrap={false}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Ocupación por tipo</Text>
            {byType.length === 0 ? (
              <Row label="Sin habitaciones cargadas" value="—" />
            ) : (
              byType.map(t => (
                <Row
                  key={t.roomTypeId}
                  label={`${t.label} (${t.rooms} hab.)`}
                  value={`${pct(t.rate)} — ${t.nightsSold}/${t.nightsAvailable}`}
                />
              ))
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Con qué se pagó</Text>
            {cuentasConGasto.map(m => (
              <Row key={m} label={PAYMENT_METHOD_LABELS[m] || m} value={money(expenses.byMethod[m])} />
            ))}
            {expenses.unspecified > 0 && (
              <Row label="Sin especificar" value={money(expenses.unspecified)} />
            )}
            {expenses.empresa > 0 && (
              <Row
                label="De la caja de la empresa"
                hint="(no del cajón diario)"
                value={money(expenses.empresa)}
              />
            )}
            {companyBalance != null && (
              <Total label="Acumulado del hotel hoy" value={money(companyBalance)} />
            )}
          </View>
        </View>

        <View style={styles.twoCol} wrap={false}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Movimiento de huéspedes</Text>
            <Row label="Reservas que llegaron" value={String(guests.arrivals)} />
            <Row label="Personas alojadas" hint="(chicos incluidos)" value={String(guests.people)} />
            {guests.avgNights > 0 && (
              <Row label="Estadía promedio" value={`${guests.avgNights.toFixed(1)} noches`} />
            )}
            {guests.lost > 0 && (
              <Row
                label="Canceladas y no-show"
                hint="(no llegaron)"
                value={String(guests.lost)}
              />
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Heladera</Text>
            {minibar.ventaTotal === 0 && minibar.consumoPersonal.unidades === 0 ? (
              <Row label="Sin movimientos en el período" value="—" />
            ) : (
              <>
                <Row
                  label="Vendido"
                  hint={`(${minibar.ventaHuesped.unidades} a huéspedes, ${minibar.ventaMostrador.unidades} en mostrador)`}
                  value={money(minibar.ventaTotal)}
                />
                {minibar.costoVendido > 0 && (
                  <Row label="Costo de lo vendido" value={money(minibar.costoVendido)} />
                )}
                {minibar.costoVendido > 0 && (
                  <Row label="Ganancia" value={money(minibar.margen)} />
                )}
                <Row
                  label="Se llevó el personal"
                  hint={`(${minibar.consumoPersonal.unidades} u. al costo)`}
                  value={money(minibar.consumoPersonal.costo)}
                />
                {minibar.merma.unidades > 0 && (
                  <Row
                    label="Mermas y roturas"
                    hint={`(${minibar.merma.unidades} u. al costo)`}
                    value={money(minibar.merma.costo)}
                  />
                )}
              </>
            )}
            {/* Que nadie la sume al total de arriba creyendo que falta. */}
            <Text style={[styles.muted, { marginTop: 4 }]}>
              Ya contada arriba: el consumo del huésped en su cobro, la venta de mostrador
              en los ingresos externos.
            </Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {hotelName} · Resumen de {monthLabel} · Generado el{' '}
          {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </Text>
      </Page>
    </Document>
  );
}
