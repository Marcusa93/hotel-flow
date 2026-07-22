import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Booking, Room, Guest, BookingStatus } from '@/types/hotel';
import { addDays, differenceInDays, format, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BookingTimelineProps {
  bookings: Booking[];
  rooms: Room[];
  guests: Map<string, Guest>;
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-400/80 border-amber-500',
  CONFIRMED: 'bg-blue-400/80 border-blue-500',
  CHECKED_IN: 'bg-emerald-500/80 border-emerald-600',
  CHECKED_OUT: 'bg-slate-300/80 border-slate-400',
  CANCELLED: 'bg-red-300/60 border-red-400',
  NO_SHOW: 'bg-rose-300/60 border-rose-400',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Alojado',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No show',
};

const DAYS_VISIBLE = 14;
const COL_WIDTH = 72; // px per day
const ROW_HEIGHT = 44; // px per room row
const ROOM_COL_WIDTH = 80; // px for room number column

export function BookingTimeline({ bookings, rooms, guests }: BookingTimelineProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(() => startOfDay(addDays(new Date(), -2)));

  const endDate = addDays(startDate, DAYS_VISIBLE);
  const today = startOfDay(new Date());

  // Sort rooms numerically
  const sortedRooms = useMemo(() =>
    [...rooms].sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10);
      const numB = parseInt(b.roomNumber, 10);
      return (isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB);
    }),
    [rooms]
  );

  // Filter bookings to visible range, excluding cancelled/no-show
  const visibleBookings = useMemo(() =>
    bookings.filter(b => {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') return false;
      const checkIn = startOfDay(new Date(b.checkInDate));
      const checkOut = startOfDay(new Date(b.checkOutDate));
      return checkIn < endDate && checkOut > startDate;
    }),
    [bookings, startDate, endDate]
  );

  // Group bookings by room
  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of visibleBookings) {
      const list = map.get(b.roomId) || [];
      list.push(b);
      map.set(b.roomId, list);
    }
    return map;
  }, [visibleBookings]);

  // Generate day columns
  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < DAYS_VISIBLE; i++) {
      result.push(addDays(startDate, i));
    }
    return result;
  }, [startDate]);

  const navigateDays = (offset: number) => {
    setStartDate(prev => addDays(prev, offset));
  };

  const goToToday = () => {
    setStartDate(startOfDay(addDays(new Date(), -2)));
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* h-full + flex para que la grilla scrollee adentro. Antes el bloque crecía
          con las 24 habitaciones, se pasaba del alto de la página y el
          overflow-hidden lo recortaba: las filas de abajo no había forma de verlas. */}
      <div className="border rounded-xl bg-card overflow-hidden h-full flex flex-col">
        {/* Header controls */}
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDays(-7)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDays(7)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {format(startDate, 'd MMM', { locale: es })} — {format(addDays(endDate, -1), 'd MMM yyyy', { locale: es })}
          </span>
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-[10px]">
            {(['CONFIRMED', 'CHECKED_IN', 'PENDING', 'CHECKED_OUT'] as BookingStatus[]).map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn('w-3 h-3 rounded-sm border', STATUS_COLORS[s])} />
                <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline grid — scrollea en los dos ejes; el sticky del encabezado de
            días recién funciona ahora que este contenedor scrollea en vertical */}
        <div className="flex-1 min-h-0 overflow-auto" ref={scrollRef}>
          <div style={{ minWidth: ROOM_COL_WIDTH + DAYS_VISIBLE * COL_WIDTH }}>
            {/* Day headers */}
            <div className="flex border-b sticky top-0 bg-card z-10">
              <div
                className="shrink-0 border-r bg-muted/50 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                style={{ width: ROOM_COL_WIDTH, height: 48 }}
              >
                Hab.
              </div>
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                const isSun = day.getDay() === 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      'shrink-0 border-r flex flex-col items-center justify-center text-center',
                      isToday && 'bg-primary/5',
                      isSun && 'bg-rose-50 dark:bg-rose-950/20',
                    )}
                    style={{ width: COL_WIDTH, height: 48 }}
                  >
                    <span className={cn(
                      'text-[10px] uppercase',
                      isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                    )}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={cn(
                      'text-sm font-medium',
                      isToday && 'text-primary'
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Room rows */}
            {sortedRooms.map(room => {
              const roomBookings = bookingsByRoom.get(room.id) || [];

              return (
                <div key={room.id} className="flex border-b relative" style={{ height: ROW_HEIGHT }}>
                  {/* Room label */}
                  <div
                    className="shrink-0 border-r bg-muted/30 flex items-center justify-center text-xs font-bold"
                    style={{ width: ROOM_COL_WIDTH }}
                  >
                    {room.roomNumber}
                  </div>

                  {/* Day cells (background grid) */}
                  <div className="relative flex-1 flex">
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          'shrink-0 border-r',
                          isSameDay(day, today) && 'bg-primary/5',
                          day.getDay() === 0 && 'bg-rose-50/50 dark:bg-rose-950/10',
                        )}
                        style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
                      />
                    ))}

                    {/* Booking bars */}
                    {roomBookings.map(booking => {
                      const checkIn = startOfDay(new Date(booking.checkInDate));
                      const checkOut = startOfDay(new Date(booking.checkOutDate));

                      const offsetDays = Math.max(0, differenceInDays(checkIn, startDate));
                      const startClipped = checkIn < startDate ? startDate : checkIn;
                      const endClipped = checkOut > endDate ? endDate : checkOut;
                      const spanDays = differenceInDays(endClipped, startClipped);

                      if (spanDays <= 0) return null;

                      const left = differenceInDays(startClipped, startDate) * COL_WIDTH;
                      const width = spanDays * COL_WIDTH - 4; // 4px gap

                      const guest = guests.get(booking.guestId);
                      const guestName = guest?.fullName || 'Sin huésped';
                      const nights = differenceInDays(checkOut, checkIn);

                      return (
                        <Tooltip key={booking.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                              className={cn(
                                'absolute top-1 rounded-md border text-[11px] font-medium text-white truncate px-1.5 cursor-pointer hover:brightness-110 transition-all shadow-sm',
                                STATUS_COLORS[booking.status],
                              )}
                              style={{
                                left: left + 2,
                                width: Math.max(width, 20),
                                height: ROW_HEIGHT - 8,
                              }}
                            >
                              {width > 50 ? guestName.split(' ')[0] : ''}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-60">
                            <p className="font-semibold">{guestName}</p>
                            <p className="text-muted-foreground">
                              {format(checkIn, 'dd/MM')} → {format(checkOut, 'dd/MM')} ({nights}n)
                            </p>
                            <p className="text-muted-foreground">
                              {STATUS_LABELS[booking.status]} · ${booking.totalAmount.toLocaleString('es-AR')}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Today indicator line */}
                    {today >= startDate && today < endDate && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                        style={{ left: differenceInDays(today, startDate) * COL_WIDTH }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
