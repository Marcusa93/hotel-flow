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
  MoreVertical
} from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
import { motion } from 'framer-motion';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBookingWithDetails, updateBookingStatus, payments } = useHotel();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const booking = id ? getBookingWithDetails(id) : undefined;

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
  const pendingAmount = booking.totalAmount - totalPaid;
  const paymentProgress = Math.min((totalPaid / booking.totalAmount) * 100, 100);

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
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.guest.email}`} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {booking.guest.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{booking.guest.fullName}</h1>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">#{booking.id.slice(0, 8)}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {nights} noches</span>
              <span>•</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {booking.adults + booking.children} huéspedes</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {booking.status === 'PENDING' && (
            <Button onClick={() => handleStatusChange('CONFIRMED')} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
              <CheckCircle className="w-4 h-4 mr-2" /> Confirmar
            </Button>
          )}
          {booking.status === 'CONFIRMED' && (
            <Button onClick={() => handleStatusChange('CHECKED_IN')} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
              <LogIn className="w-4 h-4 mr-2" /> Check-in
            </Button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <Button onClick={() => handleStatusChange('CHECKED_OUT')} className="bg-slate-800 hover:bg-slate-900 shadow-lg">
              <LogOut className="w-4 h-4 mr-2" /> Check-out
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange('CANCELLED')} className="text-destructive">
                <XCircle className="w-4 h-4 mr-2" /> Cancelar Reserva
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  {booking.roomType.name}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Entrada</span>
                    <div className="font-semibold">{format(new Date(booking.checkInDate), "EEE d MMM", { locale: es })}</div>
                    <div className="text-xs text-muted-foreground">14:00 PM</div>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-xs text-muted-foreground">Salida</span>
                    <div className="font-semibold">{format(new Date(booking.checkOutDate), "EEE d MMM", { locale: es })}</div>
                    <div className="text-xs text-muted-foreground">11:00 AM</div>
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

              <Link to={`/guests/${booking.guest.id}`} className="block">
                <Button variant="outline" className="w-full">Ver Perfil CRM</Button>
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
                <div className="text-3xl font-bold mb-1">${booking.totalAmount.toLocaleString('es-AR')}</div>
                <div className="flex items-center gap-2 text-sm mb-6">
                  <Badge variant={pendingAmount <= 0 ? "default" : "destructive"} className="rounded-full">
                    {pendingAmount <= 0 ? 'Pagado' : 'Pendiente'}
                  </Badge>
                  {pendingAmount > 0 && (
                    <span className="text-destructive font-medium">Restan ${pendingAmount.toLocaleString('es-AR')}</span>
                  )}
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
                  Registrar Pago
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
                    <Edit className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Sin notas adicionales</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payments History */}
          <Card className="glass border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Historial de Pagos</CardTitle>
              <CardDescription>Transacciones registradas para esta reserva</CardDescription>
            </CardHeader>
            <CardContent>
              {bookingPayments.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-xl">
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
                          <p className="font-medium">{payment.method}</p>
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
    </div>
  );
}
