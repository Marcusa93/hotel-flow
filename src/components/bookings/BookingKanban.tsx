import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Booking, BookingStatus, Guest, Room, RoomType } from '@/types/hotel';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, User, CreditCard, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BookingKanbanProps {
    bookings: Booking[];
    guests: Guest[];
    rooms: Room[];
    roomTypes: RoomType[];
    onStatusChange: (bookingId: string, newStatus: BookingStatus) => void;
}

const COLUMNS: { id: BookingStatus; title: string; color: string }[] = [
    { id: 'PENDING', title: 'Pendientes', color: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
    { id: 'CONFIRMED', title: 'Confirmadas', color: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
    { id: 'CHECKED_IN', title: 'Hospedados', color: 'bg-green-500/10 border-green-500/20 text-green-500' },
    { id: 'CHECKED_OUT', title: 'Salidas', color: 'bg-slate-500/10 border-slate-500/20 text-slate-500' },
];

export function BookingKanban({ bookings, guests, rooms, roomTypes, onStatusChange }: BookingKanbanProps) {

    // Group bookings by status
    const columns = useMemo(() => {
        const cols: Record<string, Booking[]> = {
            PENDING: [],
            CONFIRMED: [],
            CHECKED_IN: [],
            CHECKED_OUT: [],
        };

        bookings.forEach(booking => {
            if (cols[booking.status]) {
                cols[booking.status].push(booking);
            }
        });

        return cols;
    }, [bookings]);

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newStatus = destination.droppableId as BookingStatus;
        onStatusChange(draggableId, newStatus);
    };

    const getGuestDetails = (guestId: string) => guests.find(g => g.id === guestId);
    const getRoomDetails = (roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        const type = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : undefined;
        return { room, type };
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start">
                {COLUMNS.map(col => (
                    <div key={col.id} className="min-w-[300px] w-[300px] flex flex-col gap-3">
                        <div className={cn("p-3 rounded-xl border backdrop-blur-sm flex items-center justify-between font-medium", col.color)}>
                            <span>{col.title}</span>
                            <Badge variant="secondary" className="bg-background/50">{columns[col.id]?.length || 0}</Badge>
                        </div>

                        <Droppable droppableId={col.id}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={cn(
                                        "flex-1 min-h-[500px] rounded-xl transition-colors p-2 space-y-3",
                                        snapshot.isDraggingOver ? "bg-muted/30" : "bg-transparent"
                                    )}
                                >
                                    {columns[col.id]?.map((booking, index) => {
                                        const guest = getGuestDetails(booking.guestId);
                                        const { room, type } = getRoomDetails(booking.roomId);

                                        return (
                                            <Draggable key={booking.id} draggableId={booking.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        style={{ ...provided.draggableProps.style }}
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            whileHover={{ scale: 1.02 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <Card className={cn(
                                                                "glass border-none shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group",
                                                                snapshot.isDragging && "shadow-xl ring-2 ring-primary rotate-2"
                                                            )}>
                                                                <CardContent className="p-3 space-y-3">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <Avatar className="h-8 w-8 border-2 border-background">
                                                                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                                                    {guest?.fullName.slice(0, 2).toUpperCase()}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-semibold leading-none">{guest?.fullName}</span>
                                                                                <span className="text-[10px] text-muted-foreground">ID: {booking.id.slice(0, 4)}</span>
                                                                            </div>
                                                                        </div>
                                                                        {room && (
                                                                            <Badge variant="outline" className="text-[10px] font-mono bg-background/50 h-5">
                                                                                {room.roomNumber}
                                                                            </Badge>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground p-2 bg-background/30 rounded-lg">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Calendar className="w-3 h-3 text-primary" />
                                                                            <span>{format(new Date(booking.checkInDate), 'dd MMM')}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                                                                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                                            <span>{format(new Date(booking.checkOutDate), 'dd MMM')}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between pt-1">
                                                                        <div className="flex items-center gap-1.5 text-xs">
                                                                            <User className="w-3 h-3" />
                                                                            <span>{booking.adults}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                                            <CreditCard className="w-3 h-3" />
                                                                            <span>${booking.totalAmount.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
}
