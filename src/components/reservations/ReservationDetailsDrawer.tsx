
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, Calendar, Clock, CreditCard, X, ExternalLink } from 'lucide-react';
import { Booking, Guest, Room, RoomType } from '@/types/hotel';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReservationStatusBadge } from './ReservationStatusBadge';
import { Link } from 'react-router-dom';

interface ReservationDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    booking?: Booking;
    guest?: Guest;
    room?: Room;
    roomType?: RoomType;
}

export function ReservationDetailsDrawer({
    isOpen,
    onClose,
    booking,
    guest,
    room,
    roomType
}: ReservationDetailsDrawerProps) {
    if (!booking) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-l border-white/20 shadow-2xl">
                {/* Header with Cover Image Effect */}
                <div className="relative h-40 bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-purple-500/20">
                    <div className="absolute top-4 right-4 z-20">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/20 hover:bg-white/40">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="absolute -bottom-10 left-8 z-10">
                        <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${guest?.email}`} />
                            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                                {guest?.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    {/* Simple pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                </div>

                <ScrollArea className="h-full pt-14 pb-8 px-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {guest?.fullName}
                            </h2>
                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 rounded">
                                    #{booking.id.slice(0, 8)}
                                </span>
                                <span>•</span>
                                <ReservationStatusBadge status={booking.status} />
                            </p>
                        </div>
                        <Link to={`/bookings/${booking.id}`}>
                            <Button variant="outline" size="sm" className="hidden sm:flex">
                                Ver Pantalla Completa <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                        </Link>
                    </div>

                    <div className="space-y-8">
                        {/* Guest Info */}
                        <section className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacto</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary"><Mail className="w-4 h-4" /></div>
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                                        <p className="text-sm font-medium truncate">{guest?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary"><Phone className="w-4 h-4" /></div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase">Teléfono</p>
                                        <p className="text-sm font-medium">{guest?.phone}</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Stay Info */}
                        <section className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estadía</h3>
                                <Badge variant="outline" className="font-normal">
                                    {roomType?.name} - Hab {room?.roomNumber}
                                </Badge>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white/50 relative overflow-hidden">
                                <div className="relative z-10 text-center flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">Entrada</p>
                                    <p className="font-bold text-lg">{format(new Date(booking.checkInDate), 'd MMM')}</p>
                                    <p className="text-xs text-slate-400">14:00</p>
                                </div>
                                <div className="relative z-10 flex-none px-4 flex flex-col items-center">
                                    <span className="text-xs font-medium text-slate-400 mb-1">2 Noches</span>
                                    <div className="w-24 h-0.5 bg-slate-200"></div>
                                </div>
                                <div className="relative z-10 text-center flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">Salida</p>
                                    <p className="font-bold text-lg">{format(new Date(booking.checkOutDate), 'd MMM')}</p>
                                    <p className="text-xs text-slate-400">11:00</p>
                                </div>
                            </div>

                            {booking.notes && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/20 text-sm italic text-yellow-800 dark:text-yellow-200">
                                    "{booking.notes}"
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Payment Info */}
                        <section className="space-y-3 pb-8">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deuda y Pagos</h3>
                            <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 dark:shadow-none relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                <div className="relative z-10 flex justify-between items-end">
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase font-medium mb-1">Total a Pagar</p>
                                        <p className="text-3xl font-bold tracking-tight">${booking.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 mb-2">
                                            {booking.status === 'CHECKED_OUT' ? 'Pagado' : 'Pendiente'}
                                        </Badge>
                                        <p className="text-xs text-slate-400">
                                            {booking.adults} Adultos, {booking.children} Niños
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Button className="w-full" size="lg" variant="outline">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Gestionar Pagos
                            </Button>
                        </section>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
