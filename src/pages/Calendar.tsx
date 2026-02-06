import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function Calendar() {
  const { bookings, guests, rooms, roomTypes } = useHotel();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => {
      const checkIn = new Date(booking.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(booking.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      return (
        targetDate >= checkIn && 
        targetDate < checkOut && 
        booking.status !== 'CANCELLED' && 
        booking.status !== 'NO_SHOW'
      );
    });
  };

  const getGuestName = (guestId: string) => 
    guests.find(g => g.id === guestId)?.fullName || 'Huésped';

  const getRoomNumber = (roomId: string) => 
    rooms.find(r => r.id === roomId)?.roomNumber || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario"
        description="Vista mensual de reservas"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-xl">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </CardTitle>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-px bg-border mb-px">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map(day => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);

              return (
                <div 
                  key={day.toISOString()}
                  className={`min-h-[120px] bg-card p-2 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map(booking => (
                      <Link 
                        key={booking.id} 
                        to={`/bookings/${booking.id}`}
                        className="block"
                      >
                        <div className={`text-xs p-1 rounded truncate ${
                          booking.status === 'CHECKED_IN' 
                            ? 'bg-status-available/10 text-status-available border-l-2 border-status-available'
                            : 'bg-primary/10 text-primary border-l-2 border-primary'
                        }`}>
                          <span className="font-medium">{getRoomNumber(booking.roomId)}</span>
                          <span className="mx-1">-</span>
                          <span className="truncate">{getGuestName(booking.guestId).split(' ')[0]}</span>
                        </div>
                      </Link>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayBookings.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-status-available/20 border-l-2 border-status-available" />
          <span>Check-in realizado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/20 border-l-2 border-primary" />
          <span>Reserva confirmada</span>
        </div>
      </div>
    </div>
  );
}
