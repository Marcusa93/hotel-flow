import { useParams, useNavigate } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle, User, BedDouble, Calendar, DollarSign, Car,
  AlertTriangle, Loader2, ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Alojado',
  CHECKED_OUT: 'Check-out realizado',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No show',
};

export default function QuickCheckin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { bookings, updateBookingStatus } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const { payments } = usePaymentOperations();
  const [isProcessing, setIsProcessing] = useState(false);

  const booking = bookings.find(b => b.id === id);

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Cargando reserva...</p>
      </div>
    );
  }

  const guest = guests.find(g => g.id === booking.guestId);
  const room = rooms.find(r => r.id === booking.roomId);
  const roomType = room?.roomTypeId ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;
  const bookingPayments = payments.filter(p => p.bookingId === booking.id && p.status === 'PAID');
  const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);
  const balance = booking.totalAmount - totalPaid;
  const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate));

  const canCheckin = booking.status === 'CONFIRMED' || booking.status === 'PENDING';
  const isAlreadyCheckedIn = booking.status === 'CHECKED_IN';
  const roomIsDirty = room?.status === 'DIRTY';
  const roomInMaintenance = room?.status === 'MAINTENANCE';

  const handleCheckin = async () => {
    if (!canCheckin) return;
    setIsProcessing(true);
    try {
      await updateBookingStatus(booking.id, 'CHECKED_IN');
      toast({
        title: 'Check-in realizado',
        description: `${guest?.fullName || 'Huésped'} — Hab. ${room?.roomNumber || '?'}`,
      });
      // Navigate to booking detail for full view
      setTimeout(() => navigate(`/bookings/${booking.id}`), 1500);
    } catch {
      toast({ title: 'Error al hacer check-in', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/bookings')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Check-in Rápido</h1>
          <p className="text-sm text-muted-foreground">Reserva #{booking.id.slice(0, 8)}</p>
        </div>
        <Badge
          variant="outline"
          className={
            isAlreadyCheckedIn ? 'ml-auto bg-emerald-50 text-emerald-700 border-emerald-200' :
            canCheckin ? 'ml-auto bg-blue-50 text-blue-700 border-blue-200' :
            'ml-auto'
          }
        >
          {STATUS_LABELS[booking.status] || booking.status}
        </Badge>
      </div>

      {/* Guest info */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {guest?.fullName?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-semibold text-lg">{guest?.fullName || 'Sin huésped'}</p>
              <p className="text-sm text-muted-foreground">{guest?.email || guest?.phone || ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Habitación</p>
                <p className="font-semibold">{room?.roomNumber || '—'}</p>
                {roomType && <p className="text-[10px] text-muted-foreground">{roomType.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Estadía</p>
                <p className="font-semibold">{nights} noche{nights !== 1 ? 's' : ''}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(booking.checkInDate), 'dd/MM')} → {format(new Date(booking.checkOutDate), 'dd/MM')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Ocupantes</p>
                <p className="font-semibold">{booking.adults}A{booking.children > 0 ? ` + ${booking.children}N` : ''}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`font-semibold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {balance > 0 ? `$${balance.toLocaleString('es-AR')} pendiente` : 'Pagado'}
                </p>
              </div>
            </div>
          </div>

          {/* Vehicle */}
          {booking.hasVehicle && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Car className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Vehículo</p>
                <p className="font-semibold text-sm">
                  {booking.vehicleDescription}
                  {booking.licensePlate && <span className="ml-2 font-mono text-xs bg-background px-1.5 py-0.5 rounded">{booking.licensePlate}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-sm">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notas</p>
              <p className="text-amber-900 dark:text-amber-200 italic text-xs">{booking.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {canCheckin && (roomIsDirty || roomInMaintenance) && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            La habitación está marcada como <strong>{roomIsDirty ? 'sucia' : 'en mantenimiento'}</strong>.
            Verificá que esté lista antes de hacer el check-in.
          </p>
        </div>
      )}

      {/* Already checked in */}
      {isAlreadyCheckedIn && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Check-in ya realizado</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">El huésped ya está alojado.</p>
          </div>
        </div>
      )}

      {/* Check-in button */}
      {canCheckin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" className="w-full h-14 text-lg gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Hacer Check-in
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Check-in</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{guest?.fullName}</strong> → Hab. <strong>{room?.roomNumber}</strong>
                <br />
                {format(new Date(booking.checkInDate), 'dd/MM', { locale: es })} al {format(new Date(booking.checkOutDate), 'dd/MM', { locale: es })} ({nights} noches)
                {balance > 0 && (
                  <>
                    <br />
                    <span className="text-amber-600 font-medium">Saldo pendiente: ${balance.toLocaleString('es-AR')}</span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCheckin} className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar Check-in
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* View full detail */}
      <Button variant="outline" className="w-full" onClick={() => navigate(`/bookings/${booking.id}`)}>
        Ver detalle completo
      </Button>
    </div>
  );
}
