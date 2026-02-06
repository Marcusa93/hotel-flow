import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  BedDouble, 
  Calendar, 
  CreditCard,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingStatus } from '@/types/hotel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RegisterPaymentDialog } from '@/components/payments/RegisterPaymentDialog';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBookingWithDetails, updateBookingStatus, payments } = useHotel();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const booking = id ? getBookingWithDetails(id) : undefined;

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Reserva no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/bookings')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a reservas
        </Button>
      </div>
    );
  }

  const bookingPayments = payments.filter(p => p.bookingId === booking.id);
  const totalPaid = bookingPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = booking.totalAmount - totalPaid;

  const handleStatusChange = (newStatus: BookingStatus) => {
    updateBookingStatus(booking.id, newStatus);
  };

  const getStatusActions = () => {
    switch (booking.status) {
      case 'PENDING':
        return (
          <>
            <Button onClick={() => handleStatusChange('CONFIRMED')} className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. La reserva quedará marcada como cancelada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange('CANCELLED')}>
                    Cancelar reserva
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
      case 'CONFIRMED':
        return (
          <>
            <Button onClick={() => handleStatusChange('CHECKED_IN')} className="flex-1">
              <LogIn className="w-4 h-4 mr-2" />
              Hacer Check-in
            </Button>
            <Button variant="outline" onClick={() => handleStatusChange('NO_SHOW')}>
              No Show
            </Button>
          </>
        );
      case 'CHECKED_IN':
        return (
          <Button onClick={() => handleStatusChange('CHECKED_OUT')} className="flex-1">
            <LogOut className="w-4 h-4 mr-2" />
            Hacer Check-out
          </Button>
        );
      default:
        return null;
    }
  };

  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 
    (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reserva ${booking.id.slice(0, 8)}`}
        description={`Creada el ${format(new Date(booking.createdAt), "d 'de' MMMM, yyyy", { locale: es })}`}
        actions={
          <Button variant="outline" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status and actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Estado de la Reserva</CardTitle>
                <StatusBadge status={booking.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {getStatusActions()}
              </div>
              {booking.needsReview && (
                <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Requiere revisión</p>
                    <p className="text-xs text-muted-foreground">
                      La cantidad de huéspedes supera la capacidad recomendada
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guest info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Huésped
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre completo</p>
                  <p className="font-medium">{booking.guest.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-medium">{booking.guest.documentId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{booking.guest.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{booking.guest.phone}</p>
                </div>
              </div>
              {booking.guest.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm">{booking.guest.notes}</p>
                </div>
              )}
              <Link to={`/guests/${booking.guest.id}`}>
                <Button variant="outline" size="sm">Ver perfil completo</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Room info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BedDouble className="w-5 h-5" />
                Habitación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-medium text-xl">{booking.room.roomNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">{booking.roomType.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Piso</p>
                  <p className="font-medium">{booking.room.floor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capacidad máxima</p>
                  <p className="font-medium">{booking.roomType.maxGuests} huéspedes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stay details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Detalles de la Estadía
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-medium">
                    {format(new Date(booking.checkInDate), "EEE d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-medium">
                    {format(new Date(booking.checkOutDate), "EEE d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Noches</p>
                  <p className="font-medium">{nights}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Huéspedes</p>
                  <p className="font-medium">
                    {booking.adults} adultos{booking.children > 0 && `, ${booking.children} niños`}
                  </p>
                </div>
              </div>
              {booking.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Notas de la reserva</p>
                  <p className="text-sm mt-1">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Payments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Pagos
                </CardTitle>
                <Button size="sm" onClick={() => setIsPaymentDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total reserva</span>
                  <span className="font-medium">${booking.totalAmount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pagado</span>
                  <span className="font-medium text-status-available">${totalPaid.toLocaleString('es-AR')}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-medium">Pendiente</span>
                  <span className={`font-bold ${pendingAmount > 0 ? 'text-accent' : 'text-status-available'}`}>
                    ${pendingAmount.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Payment list */}
              {bookingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay pagos registrados
                </p>
              ) : (
                <div className="space-y-2">
                  {bookingPayments.map(payment => (
                    <div key={payment.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">${payment.amount.toLocaleString('es-AR')}</span>
                        <StatusBadge status={payment.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{format(new Date(payment.date), 'dd/MM/yyyy')}</span>
                        <span>{payment.method}</span>
                      </div>
                      {payment.reference && (
                        <p className="text-xs text-muted-foreground mt-1">Ref: {payment.reference}</p>
                      )}
                      {payment.comment && (
                        <p className="text-xs text-muted-foreground mt-1">{payment.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RegisterPaymentDialog 
        open={isPaymentDialogOpen} 
        onOpenChange={setIsPaymentDialogOpen}
        bookingId={booking.id}
        pendingAmount={pendingAmount}
      />
    </div>
  );
}
