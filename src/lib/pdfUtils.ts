import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { InvoicePDF } from './pdfTemplates/InvoicePDF';
import { PaymentReceiptPDF } from './pdfTemplates/PaymentReceiptPDF';
import { MonthlySummaryPDF, type MonthlySummaryPDFProps } from './pdfTemplates/MonthlySummaryPDF';
import type { Invoice, Payment, Guest, Booking, Room, RoomType, HotelSettings } from '@/types/hotel';

interface GenerateInvoicePDFParams {
  invoice: Invoice;
  guest?: Guest;
  booking?: Booking;
  room?: Room;
  roomType?: RoomType;
  hotelSettings?: HotelSettings;
}

export async function generateInvoicePDF(params: GenerateInvoicePDFParams): Promise<void> {
  try {
    const element = InvoicePDF(params);
    const blob = await pdf(element).toBlob();
    const fileName = `factura_${params.invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Failed to generate invoice PDF:', error);
    throw new Error('No se pudo generar el PDF de la factura');
  }
}

interface GenerateReceiptPDFParams {
  payment: Payment;
  guest?: Guest;
  room?: Room;
  roomType?: RoomType;
  hotelSettings?: HotelSettings;
  /** PNG data URL of the guest's drawn signature */
  signatureDataUrl?: string;
}

export async function generateReceiptPDF(params: GenerateReceiptPDFParams): Promise<void> {
  try {
    const element = PaymentReceiptPDF(params);
    const blob = await pdf(element).toBlob();
    const fileName = `recibo_${params.payment.id.slice(-8)}.pdf`;
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Failed to generate receipt PDF:', error);
    throw new Error('No se pudo generar el recibo PDF');
  }
}

interface GenerateMonthlySummaryPDFParams extends MonthlySummaryPDFProps {
  /** El mes en 'yyyy-MM', para nombrar el archivo. */
  month: string;
}

/**
 * El resumen del mes, descargado como archivo.
 *
 * Antes esto abría el diálogo de impresión del navegador. El contenido estaba
 * bien, pero lo que hacía falta era un archivo para mandar: sin eso, quien
 * buscaba algo descargable terminaba en el Excel de Estadísticas, que trae la
 * tabla cruda de reservas y cobros.
 */
export async function generateMonthlySummaryPDF({
  month,
  ...props
}: GenerateMonthlySummaryPDFParams): Promise<void> {
  try {
    const element = MonthlySummaryPDF(props);
    const blob = await pdf(element).toBlob();
    // Con el nombre del hotel y el mes: el socio que lo recibe tiene que saber
    // qué abrió sin abrirlo.
    const hotel = props.hotelName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    saveAs(blob, `resumen-${month}-${hotel || 'hotel'}.pdf`);
  } catch (error) {
    console.error('Failed to generate monthly summary PDF:', error);
    throw new Error('No se pudo generar el resumen en PDF');
  }
}
