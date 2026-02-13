import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Invoice, Guest, Booking, Room, RoomType, HotelSettings } from '@/types/hotel';

interface InvoicePDFProps {
  invoice: Invoice;
  guest?: Guest;
  booking?: Booking;
  room?: Room;
  roomType?: RoomType;
  hotelSettings?: HotelSettings;
}

const itemTypeLabels: Record<string, string> = {
  ACCOMMODATION: 'Alojamiento',
  SERVICE: 'Servicio',
  EXTRA: 'Extra',
  OTHER: 'Otro',
};

const formatCurrency = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 35,
  },
  hotelName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
  },
  hotelSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  invoiceNumber: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
    textAlign: 'right',
  },
  invoiceDate: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 3,
  },
  // Parties
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 35,
  },
  party: {
    flex: 1,
  },
  partyRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  partyTitle: {
    fontSize: 9,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  partyDetail: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.5,
  },
  // Items table
  table: {
    marginBottom: 25,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  colDescription: { width: '42%' },
  colType: { width: '15%' },
  colQty: { width: '10%', textAlign: 'right' },
  colUnit: { width: '15%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  cellType: {
    fontSize: 9,
    color: '#64748b',
  },
  cellNumber: {
    textAlign: 'right',
    fontSize: 10,
  },
  // Totals
  totals: {
    marginLeft: 'auto',
    width: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalRowSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: '#1e293b',
    marginTop: 6,
  },
  totalLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  totalGrandLabel: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  totalGrandValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
  },
  // Notes
  notes: {
    marginTop: 30,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  notesTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    marginTop: 50,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureLine: {
    width: 180,
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    marginTop: 50,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  generatedAt: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'right',
  },
  // Gold accent line
  accentLine: {
    height: 3,
    backgroundColor: '#D4A017',
    marginBottom: 25,
    borderRadius: 2,
  },
});

export function InvoicePDF({
  invoice,
  guest,
  booking,
  room,
  roomType,
  hotelSettings,
}: InvoicePDFProps) {
  const hotelName = hotelSettings?.hotelName || 'HoMe App';
  const hotelAddress = hotelSettings?.address || '';
  const hotelPhone = hotelSettings?.phone || '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Gold accent */}
        <View style={styles.accentLine} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hotelName}>{hotelName}</Text>
            <Text style={styles.hotelSub}>Sistema de Gesti&oacute;n Hotelera</Text>
            {hotelAddress ? <Text style={styles.hotelSub}>{hotelAddress}</Text> : null}
            {hotelPhone ? <Text style={styles.hotelSub}>Tel: {hotelPhone}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>
              Emitida: {format(new Date(invoice.issueDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </Text>
            {invoice.dueDate && (
              <Text style={styles.invoiceDate}>
                Vence: {format(new Date(invoice.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </Text>
            )}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyTitle}>Facturar a</Text>
            <Text style={styles.partyName}>{guest?.fullName || 'Huesped'}</Text>
            {guest?.documentId && <Text style={styles.partyDetail}>DNI/CUIT: {guest.documentId}</Text>}
            {guest?.email && <Text style={styles.partyDetail}>{guest.email}</Text>}
            {guest?.phone && <Text style={styles.partyDetail}>{guest.phone}</Text>}
          </View>
          <View style={styles.partyRight}>
            <Text style={styles.partyTitle}>Detalles de Estadia</Text>
            <Text style={styles.partyDetail}>
              Habitacion {room?.roomNumber || '-'} ({roomType?.name || ''})
            </Text>
            {booking && (
              <Text style={styles.partyDetail}>
                {format(new Date(booking.checkInDate), 'dd MMM', { locale: es })} -{' '}
                {format(new Date(booking.checkOutDate), 'dd MMM yyyy', { locale: es })}
              </Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Concepto</Text>
            <Text style={[styles.tableHeaderCell, styles.colType]}>Tipo</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty, { textAlign: 'right' }]}>Cant.</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit, { textAlign: 'right' }]}>P. Unit.</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal, { textAlign: 'right' }]}>Total</Text>
          </View>
          {invoice.items?.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.cellBold, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.cellType, styles.colType]}>
                {itemTypeLabels[item.itemType] || item.itemType}
              </Text>
              <Text style={[styles.cellNumber, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.cellNumber, styles.colUnit]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[styles.cellNumber, styles.colTotal]}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRowSubtotal}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA ({invoice.taxRate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.taxAmount)}</Text>
          </View>
          <View style={styles.totalRowGrand}>
            <Text style={styles.totalGrandLabel}>Total</Text>
            <Text style={styles.totalGrandValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notas</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Huesped</Text>
          </View>
          <Text style={styles.generatedAt}>
            Generado el {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
