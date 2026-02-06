import { useState } from 'react';
import { FileText, Download, Eye, Printer } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StubIndicator, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

export default function Billing() {
  const { bookings, guests, rooms, roomTypes, payments } = useHotel();
  const [previewBooking, setPreviewBooking] = useState<string | null>(null);

  // Get completed bookings with payments
  const billedBookings = bookings.filter(b => 
    b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN'
  );

  const getBookingDetails = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return null;
    
    const guest = guests.find(g => g.id === booking.guestId);
    const room = rooms.find(r => r.id === booking.roomId);
    const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;
    const bookingPayments = payments.filter(p => p.bookingId === bookingId);
    
    return { booking, guest, room, roomType, payments: bookingPayments };
  };

  const previewData = previewBooking ? getBookingDetails(previewBooking) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Generación de recibos y facturas"
        actions={
          <StubIndicator message="PDF se conectará a backend" />
        }
      />

      {/* Tax configuration stub */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Configuración de Impuestos</CardTitle>
            <StubIndicator message="Configuración pendiente" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">IVA</p>
              <p className="text-xl font-bold">21%</p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">Tasa Municipal</p>
              <p className="text-xl font-bold">3%</p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">Otros Impuestos</p>
              <p className="text-xl font-bold">0%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings to bill */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reservas Facturables</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Reserva</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead>Habitación</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[150px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billedBookings.slice(0, 10).map(booking => {
                const guest = guests.find(g => g.id === booking.guestId);
                const room = rooms.find(r => r.id === booking.roomId);
                
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs">
                      {booking.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {guest?.fullName || '-'}
                    </TableCell>
                    <TableCell>{room?.roomNumber || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(booking.checkInDate), 'dd/MM')} - {format(new Date(booking.checkOutDate), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${booking.totalAmount.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setPreviewBooking(booking.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice preview dialog */}
      <Dialog open={!!previewBooking} onOpenChange={() => setPreviewBooking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista Previa de Factura</DialogTitle>
            <DialogDescription>
              <StubIndicator message="Se conectará a backend para generar PDF" />
            </DialogDescription>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-6 p-6 border rounded-lg bg-card">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Hotel Demo</h2>
                  <p className="text-sm text-muted-foreground">Av. Principal 123</p>
                  <p className="text-sm text-muted-foreground">Ciudad, CP 1234</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">Factura #{previewData.booking.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Guest info */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Facturar a:</p>
                <p className="font-medium">{previewData.guest?.fullName}</p>
                <p className="text-sm">{previewData.guest?.email}</p>
                {previewData.guest?.documentId && (
                  <p className="text-sm">DNI/CUIT: {previewData.guest.documentId}</p>
                )}
              </div>

              <Separator />

              {/* Details */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <p className="font-medium">Alojamiento - {previewData.roomType?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Hab. {previewData.room?.roomNumber} | {format(new Date(previewData.booking.checkInDate), 'dd/MM')} - {format(new Date(previewData.booking.checkOutDate), 'dd/MM/yy')}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.ceil((new Date(previewData.booking.checkOutDate).getTime() - new Date(previewData.booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} noches
                      </TableCell>
                      <TableCell className="text-right">
                        ${previewData.roomType?.basePrice.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${previewData.booking.totalAmount.toLocaleString('es-AR')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${(previewData.booking.totalAmount / 1.21).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (21%)</span>
                  <span>${(previewData.booking.totalAmount - previewData.booking.totalAmount / 1.21).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${previewData.booking.totalAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Payments */}
              {previewData.payments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Pagos registrados:</p>
                    {previewData.payments.map(p => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(p.date), 'dd/MM/yy')} - {p.method}
                        </span>
                        <span className={p.status === 'PAID' ? 'text-status-available' : ''}>
                          ${p.amount.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewBooking(null)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              alert('Generación de PDF se conectará a backend');
            }}>
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
