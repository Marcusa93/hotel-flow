
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Booking, Guest, Room, RoomType } from '@/types/hotel';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, BedDouble, Moon, CreditCard } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ReservationCardProps {
    booking: Booking;
    guest?: Guest;
    room?: Room;
    roomType?: RoomType;
    index: number;
    onClick: () => void;
}

export const ReservationCard = React.memo(function ReservationCard({ booking, guest, room, roomType, index, onClick }: ReservationCardProps) {
    const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate));

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
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 cursor-grab active:cursor-grabbing group relative overflow-hidden",
                            snapshot.isDragging && "shadow-2xl ring-2 ring-primary/20 rotate-1 z-50 scale-105"
                        )}
                    >
                        {/* Hover Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        {/* Header: Avatar + Name */}
                        <div className="flex items-center gap-3 relative z-10 mb-3">
                            <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                    {guest?.fullName?.slice(0, 2).toUpperCase() || '??'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">
                                    {guest?.fullName || 'Huésped Desconocido'}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    #{booking.id.slice(0, 6)}
                                </p>
                            </div>
                        </div>

                        {/* Body: Dates + Room */}
                        <div className="space-y-1.5 relative z-10 mb-4">
                            <div className="flex items-center text-xs text-muted-foreground/80">
                                <Calendar className="w-3 h-3 mr-1.5 opacity-70" />
                                <span className="font-medium text-slate-600 dark:text-slate-400">
                                    {format(new Date(booking.checkInDate), 'd MMM')} - {format(new Date(booking.checkOutDate), 'd MMM')}
                                </span>
                                <span className="mx-1.5 opacity-30">|</span>
                                <span className="flex items-center">
                                    <Moon className="w-3 h-3 mr-1 opacity-70" /> {nights} noches
                                </span>
                            </div>

                            <div className="flex items-center text-xs text-muted-foreground/80">
                                <BedDouble className="w-3 h-3 mr-1.5 opacity-70" />
                                <span className="font-medium text-slate-600 dark:text-slate-400">
                                    Hab. {room?.roomNumber || '?'}
                                </span>
                                <span className="mx-1 opacity-30">·</span>
                                <span className="truncate max-w-[120px]">{roomType?.name}</span>
                                <span className="mx-1 opacity-30">·</span>
                                <span>{booking.adults}p</span>
                            </div>
                        </div>

                        {/* Footer: Tags */}
                        <div className="flex items-center gap-2 relative z-10">
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal px-2 h-6 text-xs gap-1 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                                <CreditCard className="w-3 h-3" />
                                ${(booking.totalAmount / 1000).toFixed(0)}k
                            </Badge>

                            {booking.status === 'CHECKED_OUT' && (
                                <Badge variant="outline" className="border-green-200 text-green-700 text-xs h-6">Pagado</Badge>
                            )}
                        </div>

                    </motion.div>
                </div>
            )}
        </Draggable>
    );
});
