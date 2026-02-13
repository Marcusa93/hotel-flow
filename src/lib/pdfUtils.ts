import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { InvoicePDF } from './pdfTemplates/InvoicePDF';
import { PaymentReceiptPDF } from './pdfTemplates/PaymentReceiptPDF';
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
  const element = InvoicePDF(params);
  const blob = await pdf(element).toBlob();
  const fileName = `factura_${params.invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
  saveAs(blob, fileName);
}

interface GenerateReceiptPDFParams {
  payment: Payment;
  guest?: Guest;
  room?: Room;
  roomType?: RoomType;
  hotelSettings?: HotelSettings;
}

export async function generateReceiptPDF(params: GenerateReceiptPDFParams): Promise<void> {
  const element = PaymentReceiptPDF(params);
  const blob = await pdf(element).toBlob();
  const fileName = `recibo_${params.payment.id.slice(-8)}.pdf`;
  saveAs(blob, fileName);
}
