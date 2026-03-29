
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Booking, Guest, Room, RoomType, Payment } from '@/types/hotel';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, BedDouble, Moon, CreditCard, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ReservationCardProps {
    booking: Booking;
    guest?: Guest;
    room?: Room;
    roomType?: RoomType;
    totalPaid?: number;
    index: number;
    onClick: () => void;
}

export const ReservationCard = React.memo(function ReservationCard({ booking, guest, room, roomType, totalPaid = 0, index, onClick }: ReservationCardProps) {
    const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate));
    const balance = booking.totalAmount - totalPaid;
    const paymentRatio = booking.totalAmount > 0 ? totalPaid / booking.totalAmount : 0;

    // Payment status
    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (paymentRatio >= 1) paymentStatus = 'paid';
    else if (paymentRatio > 0) paymentStatus = 'partial';

    const PaymentIcon = paymentStatus === 'paid' ? CheckCircle : paymentStatus === 'partial' ? AlertCircle : XCircle;
    const paymentColors = {
        paid: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
        partial: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
        unpaid: 'text-red-500 bg-red-50 dark:bg-red-950/30',
    };
    const paymentLabel = {
        paid: 'Pagado',
        partial: `Debe $${balance.toLocaleString()}`,
        unpaid: 'Sin pagar',
    };

    return (
        <Draggable draggableId={booking.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{ ...provided.draggableProps.style }}
                    className="mb-3"
                    onClick={onClick}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -3, transition: { duration: 0.15 } }}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 cursor-grab active:cursor-grabbing group relative overflow-hidden",
                            snapshot.isDragging && "shadow-2xl ring-2 ring-primary/20 rotate-1 z-50 scale-105"
                        )}
                    >
                        {/* Header: Name + Room badge */}
                        <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                    {guest?.fullName?.slice(0, 2).toUpperCase() || '??'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-[15px] leading-tight">
                                    {guest?.fullName || 'Huésped'}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                    <BedDouble className="w-3 h-3" />
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                                        {room?.roomNumber || '?'}
                                    </span>
                                    {roomType && (
                                        <>
                                            <span className="opacity-30">·</span>
                                            <span className="truncate">{roomType.maxGuests}p</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Dates row */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 mb-3">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 opacity-60" />
                                <span className="font-medium">
                                    {format(new Date(booking.checkInDate), 'dd/MM')} → {format(new Date(booking.checkOutDate), 'dd/MM')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Moon className="w-3 h-3 opacity-60" />
                                <span className="font-semibold">{nights}N</span>
                            </div>
                        </div>

                        {/* Footer: Amount + Payment indicator */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                ${booking.totalAmount.toLocaleString()}
                            </div>
                            <Badge variant="secondary" className={cn('text-[10px] font-semibold gap-1 h-5 px-2', paymentColors[paymentStatus])}>
                                <PaymentIcon className="w-3 h-3" />
                                {paymentLabel[paymentStatus]}
                            </Badge>
                        </div>
                    </motion.div>
                </div>
            )}
        </Draggable>
    );
});
