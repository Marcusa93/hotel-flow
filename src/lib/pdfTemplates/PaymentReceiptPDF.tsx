import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Payment, Guest, Room, RoomType, HotelSettings } from '@/types/hotel';

interface PaymentReceiptPDFProps {
  payment: Payment;
  guest?: Guest;
  room?: Room;
  roomType?: RoomType;
  hotelSettings?: HotelSettings;
}

const methodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const statusLabels: Record<string, string> = {
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
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
  accentLine: {
    height: 3,
    backgroundColor: '#D4A017',
    marginBottom: 25,
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  hotelName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
    marginBottom: 4,
  },
  receiptTitle: {
    fontSize: 16,
    color: '#4f46e5',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  receiptId: {
    fontSize: 10,
    color: '#64748b',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 9,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
  },
  value: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  amountBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    marginVertical: 25,
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
  },
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
  thankYou: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 30,
    fontStyle: 'italic',
  },
});

export function PaymentReceiptPDF({
  payment,
  guest,
  room,
  roomType,
  hotelSettings,
}: PaymentReceiptPDFProps) {
  const hotelName = hotelSettings?.hotelName || 'HoMe App';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Gold accent */}
        <View style={styles.accentLine} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.hotelName}>{hotelName}</Text>
          <Text style={styles.receiptTitle}>Recibo de Pago</Text>
          <Text style={styles.receiptId}>#{payment.id.slice(-8).toUpperCase()}</Text>
        </View>

        <View style={styles.divider} />

        {/* Guest info */}
        {guest && (
          <View>
            <Text style={styles.sectionTitle}>Datos del Huesped</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre</Text>
              <Text style={styles.value}>{guest.fullName}</Text>
            </View>
            {guest.documentId && (
              <View style={styles.row}>
                <Text style={styles.label}>Documento</Text>
                <Text style={styles.value}>{guest.documentId}</Text>
              </View>
            )}
            {room && (
              <View style={styles.row}>
                <Text style={styles.label}>Habitacion</Text>
                <Text style={styles.value}>
                  {room.roomNumber} {roomType ? `(${roomType.maxGuests} personas)` : ''}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
          </View>
        )}

        {/* Payment details */}
        <Text style={styles.sectionTitle}>Detalle del Pago</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha</Text>
          <Text style={styles.value}>
            {format(new Date(payment.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Metodo</Text>
          <Text style={styles.value}>{methodLabels[payment.method] || payment.method}</Text>
        </View>
        {payment.reference && (
          <View style={styles.row}>
            <Text style={styles.label}>Referencia</Text>
            <Text style={styles.value}>{payment.reference}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Estado</Text>
          <Text style={styles.value}>{statusLabels[payment.status] || payment.status}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Monto Total</Text>
          <Text style={styles.amountValue}>{formatCurrency(payment.amount)}</Text>
        </View>

        {/* Comment */}
        {payment.comment && (
          <View>
            <Text style={styles.sectionTitle}>Comentario</Text>
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
              {payment.comment}
            </Text>
          </View>
        )}

        {/* Thank you */}
        <Text style={styles.thankYou}>Gracias por su estadia</Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma</Text>
          </View>
          <Text style={styles.generatedAt}>
            Generado el {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
