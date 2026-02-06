import { useState, useMemo } from 'react';
import { useHotel } from '@/context/HotelContext';
import {
  CalendarHeader,
  CalendarControls,
  MonthView,
  WeekView,
  TimelineView
} from '@/components/calendar';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  differenceInDays,
  addDays
} from 'date-fns';

type CalendarViewMode = 'month' | 'week' | 'timeline';
type HeatmapMode = 'none' | 'occupancy' | 'revenue';

export default function Calendar() {
  const { bookings, guests, rooms, roomTypes } = useHotel();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewMode>('timeline'); // Default to Timeline for the WOW factor
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');

  // --- Date Logic ---
  const activeInterval = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return { start, end };
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { start, end };
    } else {
      // Timeline View: 30 days starting from current date or slightly before
      const start = addDays(currentDate, -2); // Start a bit before to give context
      const end = addDays(currentDate, 28);
      return { start, end };
    }
  }, [currentDate, view]);

  const days = eachDayOfInterval(activeInterval);
  const today = new Date();

  // --- Data Filtering & Helper Logic ---
  const filteredRooms = useMemo(() => {
    return selectedRoomType === 'all'
      ? rooms
      : rooms.filter(r => r.roomTypeId === selectedRoomType);
  }, [rooms, selectedRoomType]);

  const filteredRoomIds = useMemo(() => filteredRooms.map(r => r.id), [filteredRooms]);

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => {
      // Filter by status
      if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) return false;

      // Filter by room type
      if (!filteredRoomIds.includes(booking.roomId)) return false;

      const checkIn = new Date(booking.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(booking.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      const target = new Date(date);
      target.setHours(0, 0, 0, 0);

      // Simple intersection check
      return target >= checkIn && target < checkOut;
    });
  };

  const calculateDailyRevenue = (day: Date) => {
    const dayBookings = getBookingsForDay(day);
    return dayBookings.reduce((sum, booking) => {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = differenceInDays(checkOut, checkIn) || 1;
      return sum + (booking.totalAmount / nights);
    }, 0);
  };

  const getHeatmapColor = (day: Date) => {
    if (heatmapMode === 'none') return undefined;

    const dayBookings = getBookingsForDay(day);
    const totalCapacity = filteredRooms.length || 1;

    if (heatmapMode === 'occupancy') {
      const occupancy = dayBookings.length / totalCapacity;
      if (occupancy === 0) return 'transparent';
      if (occupancy < 0.3) return 'rgba(16, 185, 129, 0.2)'; // Emerald
      if (occupancy < 0.6) return 'rgba(245, 158, 11, 0.25)'; // Amber
      if (occupancy < 0.8) return 'rgba(249, 115, 22, 0.35)'; // Orange
      return 'rgba(244, 63, 94, 0.45)'; // Rose (High)
    }

    if (heatmapMode === 'revenue') {
      const revenue = calculateDailyRevenue(day);
      const maxPotentialRevenue = totalCapacity * 200;
      const intensity = Math.min(revenue / maxPotentialRevenue, 1);

      if (intensity === 0) return 'transparent';
      if (intensity < 0.25) return 'rgba(16, 185, 129, 0.1)';
      if (intensity < 0.5) return 'rgba(16, 185, 129, 0.25)';
      if (intensity < 0.75) return 'rgba(16, 185, 129, 0.4)';
      return 'rgba(5, 150, 105, 0.5)';
    }
  };

  // --- Stats Calculation ---
  const monthStats = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start, end });

    let totalOccupiedNights = 0;
    let totalRevenue = 0;

    daysInMonth.forEach(day => {
      const dayBookings = getBookingsForDay(day);
      totalOccupiedNights += dayBookings.length;
      totalRevenue += calculateDailyRevenue(day);
    });

    const capacity = daysInMonth.length * filteredRooms.length;
    const occupancyRate = capacity > 0 ? (totalOccupiedNights / capacity) * 100 : 0;

    return { occupancyRate, totalRevenue };
  }, [currentDate, bookings, filteredRooms, selectedRoomType]);

  // --- Handlers ---
  const navigateDate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    } else if (view === 'week') {
      setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    } else {
      // Timeline moves by 1 week
      setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    }
  };

  const getGuestDetails = (id: string) => guests.find(g => g.id === id);
  const getRoomNumber = (id: string) => rooms.find(r => r.id === id)?.roomNumber || '?';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden px-6 py-6 pb-20">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col space-y-4">

        {/* Header Section */}
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          stats={monthStats}
        />

        {/* Controls Bar */}
        <CalendarControls
          view={view}
          onViewChange={setView}
          heatmapMode={heatmapMode}
          onHeatmapModeChange={setHeatmapMode}
          selectedRoomType={selectedRoomType}
          onRoomTypeChange={setSelectedRoomType}
          roomTypes={roomTypes}
          onNavigate={navigateDate}
          onToday={() => setCurrentDate(new Date())}
        />

        {/* Conditional View Rendering */}
        <div className="flex-1 min-h-0 flex flex-col relative animate-in fade-in zoom-in-95 duration-500">
          {view === 'month' && (
            <MonthView
              days={days}
              today={today}
              currentDate={currentDate}
              bookings={bookings}
              heatmapMode={heatmapMode}
              getHeatmapColor={getHeatmapColor}
              calculateDailyRevenue={calculateDailyRevenue}
              getBookingsForDay={getBookingsForDay}
              getGuest={getGuestDetails}
              getRoomNumber={getRoomNumber}
            />
          )}

          {view === 'week' && (
            <WeekView
              days={days}
              today={today}
              currentDate={currentDate}
              bookings={bookings}
              heatmapMode={heatmapMode}
              getHeatmapColor={getHeatmapColor}
              calculateDailyRevenue={calculateDailyRevenue}
              getBookingsForDay={getBookingsForDay}
              getGuest={getGuestDetails}
              getRoomNumber={getRoomNumber}
            />
          )}

          {view === 'timeline' && (
            <TimelineView
              days={days}
              rooms={filteredRooms}
              bookings={bookings}
              getGuest={getGuestDetails}
              getBookingsForDay={getBookingsForDay}
            />
          )}
        </div>
      </div>
    </div>
  );
}
