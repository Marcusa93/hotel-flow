import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Booking, Payment, DashboardStats, OccupancyByType, AuditLog } from '@/types/hotel';
import { escapeHtml } from '@/lib/utils';

// ---------- Excel Export ----------

interface ExportExcelParams {
  bookings: Booking[];
  payments: Payment[];
  stats: DashboardStats;
  occupancyByType: OccupancyByType[];
  dateRange: { from: Date; to: Date };
  hotelName?: string;
}

export function exportToExcel({
  bookings, payments, stats, occupancyByType, dateRange, hotelName = 'Hotel',
}: ExportExcelParams) {
  const wb = utils.book_new();

  // Sheet 1: Resumen
  const summaryData = [
    ['Reporte de Estadísticas', ''],
    ['Hotel', hotelName],
    ['Período', `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`],
    ['Generado', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })],
    ['', ''],
    ['Indicador', 'Valor'],
    ['Tasa de Ocupación', `${stats.occupancyRate.toFixed(1)}%`],
    ['Total Habitaciones', stats.totalRooms],
    ['Habitaciones Ocupadas', stats.occupiedRooms],
    ['Habitaciones Disponibles', stats.availableRooms],
    ['Check-Ins Hoy', stats.checkInsToday],
    ['Check-Outs Hoy', stats.checkOutsToday],
    ['Ingresos del Mes', `$${stats.monthlyRevenue.toLocaleString('es-AR')}`],
    ['Pagos Pendientes', `$${stats.pendingPayments.toLocaleString('es-AR')}`],
    ['Reservas Próx. 7 Días', stats.upcomingBookings7Days],
  ];
  const wsResumen = utils.aoa_to_sheet(summaryData);
  wsResumen['!cols'] = [{ wch: 25 }, { wch: 30 }];
  utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Sheet 2: Ocupación por Tipo
  const occupancyRows = occupancyByType.map(o => ({
    Tipo: o.roomTypeName,
    Total: o.total,
    Ocupadas: o.occupied,
    'Tasa (%)': Number(o.rate.toFixed(1)),
  }));
  if (occupancyRows.length > 0) {
    const wsOcupacion = utils.json_to_sheet(occupancyRows);
    utils.book_append_sheet(wb, wsOcupacion, 'Ocupación');
  }

  // Sheet 3: Reservas
  const filteredBookings = bookings.filter(b => {
    const checkIn = new Date(b.checkInDate);
    return checkIn >= dateRange.from && checkIn <= dateRange.to;
  });
  const bookingRows = filteredBookings.map(b => ({
    ID: b.id.slice(-8),
    'Check-In': format(new Date(b.checkInDate), 'dd/MM/yyyy'),
    'Check-Out': format(new Date(b.checkOutDate), 'dd/MM/yyyy'),
    Estado: b.status,
    Adultos: b.adults,
    Niños: b.children,
    Monto: b.totalAmount,
  }));
  const wsReservas = utils.json_to_sheet(bookingRows.length > 0 ? bookingRows : [{ Info: 'Sin reservas en el período' }]);
  utils.book_append_sheet(wb, wsReservas, 'Reservas');

  // Sheet 4: Pagos
  const filteredPayments = payments.filter(p => {
    const pDate = new Date(p.date);
    return pDate >= dateRange.from && pDate <= dateRange.to;
  });
  const paymentRows = filteredPayments.map(p => ({
    ID: p.id.slice(-8),
    Fecha: format(new Date(p.date), 'dd/MM/yyyy'),
    Método: p.method,
    Monto: p.amount,
    Estado: p.status,
    Referencia: p.reference || '',
  }));
  const wsPagos = utils.json_to_sheet(paymentRows.length > 0 ? paymentRows : [{ Info: 'Sin pagos en el período' }]);
  utils.book_append_sheet(wb, wsPagos, 'Pagos');

  // Download
  const fileName = `estadisticas_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.xlsx`;
  writeFile(wb, fileName);
}

/** Generic one-sheet Excel export for simple row lists (e.g. invoices) */
export function exportRowsToExcel(
  rows: Record<string, unknown>[],
  fileName: string,
  sheetName = 'Datos',
) {
  const wb = utils.book_new();
  const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: 'Sin datos' }]);
  utils.book_append_sheet(wb, ws, sheetName);
  writeFile(wb, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ---------- PDF Export (print-based) ----------

interface ExportPDFParams {
  stats: DashboardStats;
  occupancyByType: OccupancyByType[];
  revenueByDay: { date: string; revenue: number }[];
  dateRange: { from: Date; to: Date };
  hotelName?: string;
}

export function exportToPDF({
  stats, occupancyByType, revenueByDay, dateRange, hotelName = 'Hotel',
}: ExportPDFParams) {
  const printWindow = window.open('', '', 'width=900,height=700');
  if (!printWindow) return;

  const h = escapeHtml;
  const occupancyRows = occupancyByType
    .map(o => `<tr><td>${h(o.roomTypeName)}</td><td>${o.total}</td><td>${o.occupied}</td><td>${o.rate.toFixed(1)}%</td></tr>`)
    .join('');

  const revenueRows = revenueByDay
    .map(r => `<tr><td>${h(r.date)}</td><td>$${r.revenue.toLocaleString('es-AR')}</td></tr>`)
    .join('');

  printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Reporte - ${h(hotelName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #003366; padding-bottom: 20px; }
  .hotel-name { font-size: 24px; font-weight: bold; color: #003366; }
  .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
  .date-range { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #f8fafc; padding: 14px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
  .kpi-value { font-size: 22px; font-weight: bold; color: #003366; }
  .kpi-label { font-size: 10px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 600; color: #003366; border-bottom: 2px solid #D4A017; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="header">
    <div class="hotel-name">${h(hotelName)}</div>
    <div class="subtitle">Reporte de Estadísticas</div>
    <div class="date-range">${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${stats.occupancyRate.toFixed(0)}%</div><div class="kpi-label">Ocupación</div></div>
    <div class="kpi"><div class="kpi-value">$${stats.monthlyRevenue.toLocaleString('es-AR')}</div><div class="kpi-label">Ingresos Mes</div></div>
    <div class="kpi"><div class="kpi-value">${stats.checkInsToday}</div><div class="kpi-label">Check-Ins Hoy</div></div>
    <div class="kpi"><div class="kpi-value">${stats.checkOutsToday}</div><div class="kpi-label">Check-Outs Hoy</div></div>
  </div>
  <div class="section">
    <div class="section-title">Ocupación por Tipo de Habitación</div>
    <table><thead><tr><th>Tipo</th><th>Total</th><th>Ocupadas</th><th>Tasa</th></tr></thead>
    <tbody>${occupancyRows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Ingresos Últimos 7 Días</div>
    <table><thead><tr><th>Día</th><th>Ingresos</th></tr></thead>
    <tbody>${revenueRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table>
  </div>
  <div class="footer">
    <p>Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })} — ${h(hotelName)}</p>
  </div>
</body></html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

// ---------- Audit Log Export ----------

const entityTypeLabels: Record<string, string> = {
  booking: 'Reserva',
  guest: 'Huésped',
  room: 'Habitación',
  payment: 'Pago',
  invoice: 'Factura',
  housekeeping_task: 'Limpieza',
  rate: 'Tarifa',
  expense: 'Gasto',
  hotel_settings: 'Configuración',
  booking_charge: 'Cargo de Reserva',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de Estado',
};

interface ExportAuditLogsParams {
  auditLogs: AuditLog[];
  dateRange?: { from: Date; to: Date };
  hotelName?: string;
}

export function exportAuditLogsToExcel({
  auditLogs,
  dateRange,
  hotelName = 'Hotel',
}: ExportAuditLogsParams) {
  const wb = utils.book_new();

  const rows = auditLogs.map(log => ({
    Fecha: format(log.createdAt, 'dd/MM/yyyy HH:mm', { locale: es }),
    Entidad: entityTypeLabels[log.entityType] || log.entityType,
    Acción: actionLabels[log.action] || log.action,
    Descripción: log.description,
    Usuario: log.userEmail || log.userId || 'Sistema',
    Rol: log.userRole || '-',
    'ID Entidad': log.entityId.slice(-8),
  }));

  const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: 'Sin registros en el período seleccionado' }]);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 50 },
    { wch: 25 },
    { wch: 12 },
    { wch: 10 },
  ];
  utils.book_append_sheet(wb, ws, 'Registro de Actividad');

  const fileName = `audit_log_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  writeFile(wb, fileName);
}
