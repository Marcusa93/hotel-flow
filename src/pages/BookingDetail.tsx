import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  BedDouble,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  AlertTriangle,
  Plus,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Car,
  Pencil
} from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { StatusBadge, PageSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingStatus } from '@/types/hotel';
import { cn, formatLastNameFirst, getInitials } from '@/lib/utils';
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
import { CheckoutDialog } from '@/components/bookings/CheckoutDialog';
import { EditBookingDialog } from '@/components/bookings/EditBookingDialog';
import { BookingChargesSection } from '@/components/bookings/BookingChargesSection';
import { useBookingCharges } from '@/hooks/useBookingCharges';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { motion } from 'framer-motion';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBookingWithDetails, updateBookingStatus, updateBooking, isLoading: bookingsLoading } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const { payments } = usePaymentOperations();
  const isLoading = bookingsLoading;
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const { data: bookingCharges = [] } = useBookingCharges(id);
  const { data: hotelSettings } = useHotelSettings();
  const checkInTime = hotelSettings?.checkInTime || '14:00';
  const checkOutTime = hotelSettings?.checkOutTime || '11:00';

  const booking = id ? getBookingWithDetails(id, guests, rooms, roomTypes, payments) : undefined;

  // Show loading while data is being fetched
  if (isLoading) {
    return <PageSkeleton kpiCount={3} tableRows={4} />;
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
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
  const totalCharges = bookingCharges.reduce((sum, c) => sum + c.amount * c.quantity, 0);
  const totalAccount = booking.totalAmount + totalCharges;
  const pendingAmount = totalAccount - totalPaid;
  const paymentProgress = totalAccount > 0 ? Math.min((totalPaid / totalAccount) * 100, 100) : 0;

  const handleStatusChange = (newStatus: BookingStatus) => {
    updateBookingStatus(booking.id, newStatus);
  };

  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background/40 backdrop-blur-md p-6 rounded-2xl border sticky top-0 z-10 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/bookings')} className="rounded-full hover:bg-background/80">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-lg">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {getInitials(booking.guest.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{formatLastNameFirst(booking.guest.fullName)}</h1>
              <StatusBadge status={booking.status} />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mt-1">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">#{booking.id.slice(0, 8)}</span>
              <span className="hidden md:inline">•</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {nights} noches</span>
              <span className="hidden md:inline">•</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {booking.adults + booking.children} huéspedes</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {booking.status === 'PENDING' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                  <CheckCircle className="w-4 h-4 mr-2" /> Confirmar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reserva</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Confirmar la reserva de <strong>{formatLastNameFirst(booking.guest.fullName)}</strong> en la habitación <strong>{booking.room.roomNumber}</strong> por {nights} noches (${booking.totalAmount.toLocaleString('es-AR')})?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange('CONFIRMED')} className="bg-blue-600 hover:bg-blue-700">
                    Confirmar Reserva
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {booking.status === 'CONFIRMED' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
                  <LogIn className="w-4 h-4 mr-2" /> Check-in
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Check-in</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        ¿Registrar el ingreso de <strong>{formatLastNameFirst(booking.guest.fullName)}</strong> a la habitación <strong>{booking.room.roomNumber}</strong>?
                        La habitación pasará a estado Ocupada.
                      </p>
                      {booking.room.status === 'DIRTY' && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>⚠ La habitación está marcada como <strong>sucia</strong>. Se recomienda limpiarla antes del ingreso.</span>
                        </div>
                      )}
                      {booking.room.status === 'MAINTENANCE' && (
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>⚠ La habitación está en <strong>mantenimiento</strong>. Verifique que esté habilitada antes del ingreso.</span>
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange('CHECKED_IN')} className="bg-emerald-600 hover:bg-emerald-700">
                    {booking.room.status === 'DIRTY' || booking.room.status === 'MAINTENANCE' ? 'Check-in de todas formas' : 'Confirmar Check-in'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {booking.status === 'CHECKED_IN' && (
            <Button onClick={() => setIsCheckoutDialogOpen(true)} className="bg-slate-800 hover:bg-slate-900 shadow-lg">
              <LogOut className="w-4 h-4 mr-2" /> Check-out
            </Button>
          )}

          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="rounded-full">
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
          )}

          {booking.status !== 'CANCELLED' && booking.status !== 'CHECKED_OUT' && (
            <AlertDialog onOpenChange={() => setCancelReason('')}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cancelar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    ¿Cancelar esta reserva?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        Se cancelará la reserva de <strong>{formatLastNameFirst(booking.guest.fullName)}</strong> (Hab. {booking.room.roomNumber}, {nights} noches, ${booking.totalAmount.toLocaleString()}).
                      </p>
                      {totalPaid > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                          ⚠ Esta reserva tiene <strong>${totalPaid.toLocaleString('es-AR')}</strong> pagados. Deberá gestionar el reembolso por separado.
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Motivo de cancelación</label>
                        <textarea
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
                          placeholder="Ej: Solicitud del huésped, overbooking, error de carga..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (cancelReason.trim()) {
                        updateBooking(booking.id, { notes: `${booking.notes ? booking.notes + '\n' : ''}[CANCELACIÓN: ${cancelReason.trim()}]` });
                      }
                      handleStatusChange('CANCELLED');
                    }}
                    disabled={!cancelReason.trim()}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Cancelar Reserva
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </motion.div>

      {/* Status Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-center justify-between bg-white/60 dark:bg-slate-900/40 backdrop-blur border rounded-xl p-4"
      >
        {(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const).map((step, i) => {
          const labels: Record<string, string> = { PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CHECKED_IN: 'Check-in', CHECKED_OUT: 'Check-out' };
          const icons: Record<string, typeof CheckCircle> = { PENDING: Clock, CONFIRMED: CheckCircle, CHECKED_IN: LogIn, CHECKED_OUT: LogOut };
          const StepIcon = icons[step];
          const statusOrder = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];
          const currentIdx = statusOrder.indexOf(booking.status);
          const stepIdx = statusOrder.indexOf(step);
          const isCompleted = stepIdx <= currentIdx;
          const isCurrent = stepIdx === currentIdx;

          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
                isCompleted ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/30",
                isCurrent && "ring-2 ring-primary/30",
              )}>
                <StepIcon className={cn("w-4 h-4", isCompleted ? "text-emerald-600" : "text-muted-foreground/40")} />
                <span className={cn("text-xs font-semibold", isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/50")}>
                  {labels[step]}
                </span>
              </div>
              {i < 3 && <div className={cn("flex-1 h-0.5 mx-2 rounded", isCompleted && stepIdx < currentIdx ? "bg-emerald-400" : "bg-muted")} />}
            </div>
          );
        })}

        {/* Estado de Cuenta */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Alojamiento</p>
            <p className="text-sm font-bold">${booking.totalAmount.toLocaleString()}</p>
          </div>
          {totalCharges > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">+ Extras</p>
              <p className="text-sm font-bold text-blue-600">${totalCharges.toLocaleString()}</p>
            </div>
          )}
          <div className="text-right border-l pl-3">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pagado</p>
            <p className="text-sm font-bold text-emerald-600">${totalPaid.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">
              {pendingAmount > 0 ? 'Debe' : 'Saldo'}
            </p>
            <p className={cn("text-sm font-bold", pendingAmount > 0 ? "text-red-500" : "text-emerald-600")}>
              ${pendingAmount > 0 ? pendingAmount.toLocaleString() : '0'}
            </p>
          </div>
          {bookingPayments.length > 0 && (
            <div className="text-right text-[10px] text-muted-foreground">
              {bookingPayments.length} pago{bookingPayments.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Guest Journey & Room */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <Card className="glass border-none shadow-md overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <BedDouble className="w-12 h-12 text-primary/40" />
              </div>
            </div>
            <CardContent className="-mt-12 relative z-10 px-6">
              <div className="flex justify-between items-end mb-4">
                <div className="bg-background/80 backdrop-blur-md p-4 rounded-xl border shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Habitación</p>
                  <p className="text-3xl font-bold text-primary">{booking.room.roomNumber}</p>
                </div>
                <Badge variant="outline" className="mb-4 bg-background/50 h-8 px-3">
                  {booking.roomType.maxGuests} personas
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Room housekeeping status */}
                {booking.room.status === 'DIRTY' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium">
                    <BedDouble className="w-4 h-4 shrink-0" />
                    Habitación pendiente de limpieza
                  </div>
                )}
                {booking.room.status === 'MAINTENANCE' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Habitación en mantenimiento
                  </div>
                )}
                {booking.room.status === 'AVAILABLE' && booking.status === 'CONFIRMED' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Habitación lista para check-in
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Entrada</span>
                    <div className="font-semibold">{format(new Date(booking.checkInDate), "EEE d MMM", { locale: es })}</div>
                    <div className="text-xs text-muted-foreground">desde {checkInTime} hs</div>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-xs text-muted-foreground">Salida</span>
                    <div className="font-semibold">{format(new Date(booking.checkOutDate), "EEE d MMM", { locale: es })}</div>
                    <div className="text-xs text-muted-foreground">hasta {checkOutTime} hs</div>
                  </div>
                </div>

                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000"
                    style={{ width: `${booking.status === 'CHECKED_IN' ? '50%' : booking.status === 'CHECKED_OUT' ? '100%' : '0%'}` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Llegada</span>
                  <span>Estadía</span>
                  <span>Salida</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Datos del Huésped
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/40 hover:bg-background/60 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Mail className="w-4 h-4" /></div>
                <div className="overflow-hidden">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{booking.guest.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/40 hover:bg-background/60 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Phone className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">{booking.guest.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/40 hover:bg-background/60 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><MapPin className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Origen</p>
                  <p className="text-sm font-medium">{booking.guest.country || 'No especificado'}</p>
                </div>
              </div>

              <Link to={`/guests?open=${booking.guest.id}`} className="block">
                <Button variant="outline" className="w-full">Ver Perfil Completo</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Column 2: Finance & Notes */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Finance Card */}
            <Card className="glass border-none shadow-md bg-gradient-to-br from-background to-background/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">Estado de Cuenta</CardTitle>
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">${totalAccount.toLocaleString('es-AR')}</div>
                <div className="flex items-center gap-2 text-sm mb-4">
                  <Badge variant={pendingAmount <= 0 ? "default" : "destructive"} className="rounded-full">
                    {pendingAmount <= 0 ? 'Pagado' : 'Pendiente'}
                  </Badge>
                  {pendingAmount > 0 && (
                    <span className="text-destructive font-medium">Restan ${pendingAmount.toLocaleString('es-AR')}</span>
                  )}
                </div>

                {/* Breakdown */}
                <div className="space-y-1 text-sm mb-4 p-3 rounded-lg bg-muted/40">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Alojamiento</span>
                    <span>${booking.totalAmount.toLocaleString('es-AR')}</span>
                  </div>
                  {totalCharges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consumos</span>
                      <span>${totalCharges.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${totalAccount.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span>Progreso de pago</span>
                    <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={paymentProgress} className="h-2" />
                </div>

                <Button className="w-full" onClick={() => setIsPaymentDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {pendingAmount > 0 ? `Registrar Pago — $${pendingAmount.toLocaleString('es-AR')}` : 'Registrar Pago'}
                </Button>
              </CardContent>
            </Card>

            {/* Notes Card */}
            <Card className="glass border-none shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-base">Notas y Requerimientos</CardTitle>
              </CardHeader>
              <CardContent>
                {booking.notes ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600 dark:text-yellow-400">
                    <p className="text-sm italic">"{booking.notes}"</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground/50">
                    <AlertTriangle className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Sin notas adicionales</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Info */}
          <Card className="glass border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-500" />
                Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {booking.hasVehicle ? (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-background/40 border">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Car className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{booking.vehicleDescription || 'Vehículo sin descripción'}</p>
                    {booking.licensePlate && (
                      <p className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block tracking-wider">
                        {booking.licensePlate}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
                  <Car className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Sin vehículo</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Charges */}
          <BookingChargesSection bookingId={booking.id} />

          {/* Payments History */}
          <Card className="glass border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Historial de Pagos</CardTitle>
              <CardDescription>Transacciones registradas para esta reserva</CardDescription>
            </CardHeader>
            <CardContent>
              {bookingPayments.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-xl">
                  <CreditCard className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookingPayments.map((payment, i) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-background/40 hover:bg-background/60 transition-colors border border-transparent hover:border-border/50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 font-bold text-xs ring-4 ring-background">
                          ${i + 1}
                        </div>
                        <div>
                          <p className="font-medium">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(payment.date), "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600 dark:text-green-400">+${payment.amount.toLocaleString('es-AR')}</p>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Automático</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <RegisterPaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        bookingId={booking.id}
        pendingAmount={pendingAmount}
      />

      <CheckoutDialog
        open={isCheckoutDialogOpen}
        onOpenChange={setIsCheckoutDialogOpen}
        booking={booking}
        bookingPayments={bookingPayments}
        onCheckoutComplete={() => navigate('/bookings')}
      />

      <EditBookingDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        booking={booking}
      />
    </div>
  );
}
