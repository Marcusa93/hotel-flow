
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { BookingStatus } from '@/types/hotel';
import { isToday } from 'date-fns';
import {
  ReservationsHeader,
  ReservationsFilters,
  ReservationBoard,
  ReservationDetailsDrawer
} from '@/components/reservations';
import { NewBookingDialog } from '@/components/bookings/NewBookingDialog';

export default function Bookings() {
  const { bookings, updateBookingStatus } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [todayFilter, setTodayFilter] = useState<'checkin-today' | 'checkout-today' | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Handle query params from Dashboard
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsNewDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
    const filter = searchParams.get('filter');
    if (filter === 'checkin-today' || filter === 'checkout-today') {
      setTodayFilter(filter);
      setStatusFilter('ALL');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Filter Logic
  const filteredBookings = useMemo(() => {
    return bookings
      .filter(booking => {
        const guest = guests.find(g => g.id === booking.guestId);
        const room = rooms.find(r => r.id === booking.roomId);
        const searchLower = search.toLowerCase();

        const matchesSearch =
          (guest?.fullName.toLowerCase() || '').includes(searchLower) ||
          (room?.roomNumber || '').includes(searchLower) ||
          booking.id.toLowerCase().includes(searchLower);

        const matchesStatus = statusFilter === 'ALL' || booking.status === statusFilter;

        // Today filter from dashboard clicks
        let matchesToday = true;
        if (todayFilter === 'checkin-today') {
          matchesToday = isToday(new Date(booking.checkInDate)) &&
            (booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' || booking.status === 'PENDING');
        } else if (todayFilter === 'checkout-today') {
          matchesToday = isToday(new Date(booking.checkOutDate)) && booking.status === 'CHECKED_IN';
        }

        return matchesSearch && matchesStatus && matchesToday;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, guests, rooms, search, statusFilter]);

  // Data helpers for the Drawer
  const selectedBooking = useMemo(() =>
    selectedBookingId ? bookings.find(b => b.id === selectedBookingId) : undefined
    , [selectedBookingId, bookings]);

  const selectedGuest = useMemo(() =>
    selectedBooking ? guests.find(g => g.id === selectedBooking.guestId) : undefined
    , [selectedBooking, guests]);

  const selectedRoom = useMemo(() =>
    selectedBooking ? rooms.find(r => r.id === selectedBooking.roomId) : undefined
    , [selectedBooking, rooms]);

  const selectedRoomType = useMemo(() =>
    selectedRoom ? roomTypes.find(rt => rt.id === selectedRoom.roomTypeId) : undefined
    , [selectedRoom, roomTypes]);


  const handleStatusChange = (bookingId: string, newStatus: BookingStatus) => {
    updateBookingStatus(bookingId, newStatus);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Top Section: Fixed */}
      <div className="flex-none px-6 pt-6 pb-4">
        <ReservationsHeader onNewBooking={() => setIsNewDialogOpen(true)} />
        <ReservationsFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setTodayFilter(null); }}
        />
        {todayFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {todayFilter === 'checkin-today' ? 'Check-ins de hoy' : 'Check-outs de hoy'}
              <button
                onClick={() => setTodayFilter(null)}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                aria-label="Quitar filtro"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Board Section: Scrollable */}
      <div className="flex-1 min-h-0 relative mt-4">
        {/* Background Decoration */}
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10" />

        <div className="h-full px-6 pb-6">
          <ReservationBoard
            bookings={filteredBookings}
            guests={guests}
            rooms={rooms}
            roomTypes={roomTypes}
            onStatusChange={handleStatusChange}
            onCardClick={setSelectedBookingId}
          />
        </div>
      </div>

      {/* Dialogs & Drawers */}
      <NewBookingDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
      />

      <ReservationDetailsDrawer
        isOpen={!!selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        booking={selectedBooking}
        guest={selectedGuest}
        room={selectedRoom}
        roomType={selectedRoomType}
      />
    </div>
  );
}
