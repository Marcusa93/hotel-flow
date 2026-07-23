
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useAllBookingCharges } from '@/hooks/useAllBookingCharges';
import { buildAccountsByBooking, buildBookingAccount, type BookingAccount } from '@/lib/bookingAccount';
import { PaymentStateBadge } from '@/components/shared';
import { BookingStatus } from '@/types/hotel';
import { isToday, differenceInDays, format } from 'date-fns';
import {
  ReservationsHeader,
  ReservationsFilters,
  ReservationBoard,
  ReservationDetailsDrawer,
  WeeklyMovementsLog
} from '@/components/reservations';
import { NewBookingDialog } from '@/components/bookings/NewBookingDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatLastNameFirst, getInitials } from '@/lib/utils';
import {
  LayoutGrid, List,
  Calendar, BedDouble, CalendarRange, CalendarDays,
} from 'lucide-react';
import { BookingTimeline } from '@/components/bookings/BookingTimeline';
import { QRScannerDialog } from '@/components/bookings/QRScannerDialog';

type ViewMode = 'kanban' | 'list' | 'timeline';

export default function Bookings() {
  const { bookings, updateBookingStatus } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const { payments } = usePaymentOperations();
  const { data: charges = [] } = useAllBookingCharges();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [todayFilter, setTodayFilter] = useState<'checkin-today' | 'checkout-today' | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [preselectedRoomId, setPreselectedRoomId] = useState<string | undefined>(undefined);

  // Handle query params from Dashboard
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      // ?room= arrives when the booking was started from Habitaciones.
      setPreselectedRoomId(searchParams.get('room') || undefined);
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

  // El estado de cuenta de cada reserva, una sola vez para las tres vistas.
  // Incluye los cargos: sin ellos, una reserva con la habitación paga y
  // consumos pendientes se muestra como "Pagado" en todas.
  const accounts = useMemo(
    () => buildAccountsByBooking({ bookings, payments, charges }),
    [bookings, payments, charges]
  );

  // Filter Logic
  const filteredBookings = useMemo(() => {
    return bookings
      .filter(booking => {
        const guest = guests.find(g => g.id === booking.guestId);
        const room = rooms.find(r => r.id === booking.roomId);
        const searchLower = search.toLowerCase();

        const matchesSearch =
          (guest?.fullName.toLowerCase() || '').includes(searchLower) ||
          (room?.roomNumber || '').includes(searchLower);

        const matchesStatus = statusFilter === 'ALL' || booking.status === statusFilter;

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
  }, [bookings, guests, rooms, search, statusFilter, todayFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredBookings.length,
    pending: filteredBookings.filter(b => b.status === 'PENDING').length,
    confirmed: filteredBookings.filter(b => b.status === 'CONFIRMED').length,
    checkedIn: filteredBookings.filter(b => b.status === 'CHECKED_IN').length,
  }), [filteredBookings]);

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
    // El alto se descuenta a mano porque PageWrapper no define altura y un h-full
    // colapsaría al alto del contenido. Lo que se resta es la topbar (64px) más el
    // padding vertical de main, que cambia entre mobile (16+80) y desktop (24+24).
    // El calc anterior restaba 80 e ignoraba ese padding: la página desbordaba
    // 32px y había que scrollear la ventana entera para ver el final del tablero.
    // El padding horizontal también lo pone main — repetirlo acá comía 48px de
    // ancho del tablero.
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-112px)] overflow-hidden">
      {/* Top Section */}
      <div className="flex-none pb-3">
        <ReservationsHeader onNewBooking={() => setIsNewDialogOpen(true)} onScanQR={() => setIsQRScannerOpen(true)} stats={stats} />

        <div className="mt-3">
          <ReservationsFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => { setStatusFilter(v); setTodayFilter(null); }}
            trailing={
              <div className="hidden md:flex items-center bg-muted/50 rounded-xl p-1">
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setViewMode('kanban')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setViewMode('timeline')}
                  title="Timeline"
                >
                  <CalendarRange className="w-4 h-4" />
                </Button>
              </div>
            }
          />

          {/* Solo ocupa alto cuando hay un filtro de hoy activo */}
          {todayFilter && (
            <div className="mt-2">
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10 rounded-lg" onClick={() => setTodayFilter(null)}>
                {todayFilter === 'checkin-today' ? 'Check-ins de hoy' : 'Check-outs de hoy'} ✕
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Board / List Section */}
      <div className="flex-1 min-h-0 relative mt-2">
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10" />

        <div className="h-full pb-2">
          {/* Desktop: Kanban, List, or Timeline based on toggle. Mobile: always cards */}
          <div className="hidden md:block h-full">
            {viewMode === 'kanban' ? (
              <ReservationBoard
                bookings={filteredBookings}
                guests={guests}
                rooms={rooms}
                roomTypes={roomTypes}
                accounts={accounts}
                onStatusChange={handleStatusChange}
                onCardClick={setSelectedBookingId}
              />
            ) : viewMode === 'timeline' ? (
              <BookingTimeline
                bookings={filteredBookings}
                rooms={rooms}
                guests={(() => {
                  const map = new Map<string, typeof guests[0]>();
                  for (const g of guests) map.set(g.id, g);
                  return map;
                })()}
              />
            ) : (
              <BookingListView
                bookings={filteredBookings}
                guests={guests}
                rooms={rooms}
                roomTypes={roomTypes}
                accounts={accounts}
                onRowClick={(id) => navigate(`/bookings/${id}`)}
              />
            )}
          </div>
          {/* Mobile: compact card list */}
          <div className="md:hidden h-full overflow-y-auto space-y-3 pb-4">
            <MobileBookingCards
              bookings={filteredBookings}
              guests={guests}
              rooms={rooms}
              roomTypes={roomTypes}
              accounts={accounts}
              onCardClick={(id) => navigate(`/bookings/${id}`)}
            />
          </div>
        </div>
      </div>

      {/* Weekly history — what actually came in and out, independent of the filters above */}
      <div className="flex-none">
        <WeeklyMovementsLog
          bookings={bookings}
          guests={guests}
          rooms={rooms}
          onSelect={(id) => navigate(`/bookings/${id}`)}
        />
      </div>

      {/* Dialogs & Drawers */}
      <NewBookingDialog
        open={isNewDialogOpen}
        onOpenChange={(open) => {
          setIsNewDialogOpen(open);
          if (!open) setPreselectedRoomId(undefined);
        }}
        preselectedRoomId={preselectedRoomId}
      />

      <ReservationDetailsDrawer
        isOpen={!!selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        booking={selectedBooking}
        guest={selectedGuest}
        room={selectedRoom}
        roomType={selectedRoomType}
      />

      <QRScannerDialog open={isQRScannerOpen} onOpenChange={setIsQRScannerOpen} />
    </div>
  );
}

/* ── List View ── */
import { Booking, Guest, Room, RoomType } from '@/types/hotel';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  CHECKED_IN: { label: 'Hospedado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  CHECKED_OUT: { label: 'Salida', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' },
};

function BookingListView({
  bookings, guests, rooms, roomTypes, accounts, onRowClick,
}: {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  roomTypes: RoomType[];
  accounts: Map<string, BookingAccount>;
  onRowClick: (id: string) => void;
}) {
  const getGuest = (id: string) => guests.find(g => g.id === id);
  const getRoom = (id: string) => rooms.find(r => r.id === id);
  const getRoomType = (id?: string) => roomTypes.find(rt => rt.id === id);

  return (
    <div className="overflow-auto h-full rounded-xl border bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b z-10">
          <tr className="text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left p-3 font-semibold">Huésped</th>
            <th className="text-left p-3 font-semibold">Habitación</th>
            <th className="text-left p-3 font-semibold hidden sm:table-cell">Fechas</th>
            <th className="text-center p-3 font-semibold hidden md:table-cell">Noches</th>
            <th className="text-right p-3 font-semibold">Monto</th>
            <th className="text-center p-3 font-semibold">Pago</th>
            <th className="text-center p-3 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map(b => {
            const guest = getGuest(b.guestId);
            const room = getRoom(b.roomId);
            const rType = getRoomType(room?.roomTypeId);
            const nights = differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate));
            const account = accounts.get(b.id) || buildBookingAccount({ booking: b });
            const status = STATUS_LABELS[b.status] || STATUS_LABELS.PENDING;

            return (
              <tr
                key={b.id}
                onClick={() => onRowClick(b.id)}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <td className="p-3">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                    {guest ? formatLastNameFirst(guest.fullName) : 'Desconocido'}
                  </p>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono font-bold">{room?.roomNumber || '?'}</span>
                    {rType && <span className="text-xs text-muted-foreground hidden lg:inline">· {rType.name}</span>}
                  </div>
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(b.checkInDate), 'dd/MM')} → {format(new Date(b.checkOutDate), 'dd/MM')}
                  </div>
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  <span className="text-xs font-semibold">{nights}N</span>
                </td>
                <td className="p-3 text-right">
                  {/* El total a cobrar, con los consumos adentro */}
                  <span className="font-bold">${account.total.toLocaleString('es-AR')}</span>
                  {account.extras > 0 && (
                    <span className="block text-[10px] text-muted-foreground">
                      incl. ${account.extras.toLocaleString('es-AR')} extras
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <PaymentStateBadge account={account} />
                </td>
                <td className="p-3 text-center">
                  <Badge className={cn('text-[10px] font-semibold', status.color)}>
                    {status.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={7} className="p-12 text-center">
                <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">No se encontraron reservas</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Ajustá los filtros o creá una nueva reserva</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Mobile Booking Cards ── */
function MobileBookingCards({
  bookings, guests, rooms, accounts, onCardClick,
}: {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  roomTypes: RoomType[];
  accounts: Map<string, BookingAccount>;
  onCardClick: (id: string) => void;
}) {
  const getGuest = (id: string) => guests.find(g => g.id === id);
  const getRoom = (id: string) => rooms.find(r => r.id === id);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">No se encontraron reservas</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Ajustá los filtros o creá una nueva reserva</p>
      </div>
    );
  }

  return (
    <>
      {bookings.map(b => {
        const guest = getGuest(b.guestId);
        const room = getRoom(b.roomId);
        const nights = differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate));
        const account = accounts.get(b.id) || buildBookingAccount({ booking: b });
        const status = STATUS_LABELS[b.status] || STATUS_LABELS.PENDING;
        const isCheckInToday = isToday(new Date(b.checkInDate));
        const isCheckOutToday = isToday(new Date(b.checkOutDate));

        return (
          <button
            key={b.id}
            onClick={() => onCardClick(b.id)}
            className={cn(
              "w-full text-left rounded-2xl border p-4 hover:shadow-lg transition-all active:scale-[0.98] relative overflow-hidden",
              "bg-white dark:bg-slate-900 shadow-sm",
            )}
          >
            {/* Colored left accent bar */}
            <div className={cn(
              'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
              status.color.includes('emerald') ? 'bg-emerald-500' :
              status.color.includes('blue') ? 'bg-blue-500' :
              status.color.includes('amber') ? 'bg-amber-500' :
              status.color.includes('red') ? 'bg-red-500' :
              'bg-slate-400'
            )} />

            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white">
                    {getInitials(guest?.fullName || '?')}
                  </span>
                </div>
                <p className="font-bold text-[15px] text-slate-800 dark:text-slate-100 truncate">
                  {guest ? formatLastNameFirst(guest.fullName) : 'Desconocido'}
                </p>
              </div>
              <Badge className={cn('text-[10px] font-semibold shrink-0 rounded-lg', status.color)}>
                {status.label}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 pl-10">
              <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
                <BedDouble className="w-3 h-3" />
                <span className="font-bold text-slate-700 dark:text-slate-300">{room?.roomNumber || '?'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(b.checkInDate), 'dd/MM')} → {format(new Date(b.checkOutDate), 'dd/MM')}
              </span>
              <span className="font-bold text-slate-600 dark:text-slate-400">{nights}N</span>
              {isCheckInToday && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">LLEGA HOY</span>}
              {isCheckOutToday && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">SALE HOY</span>}
            </div>

            <div className="flex items-center justify-between pl-10">
              <span className="font-extrabold text-base text-slate-900 dark:text-white">
                ${account.total.toLocaleString('es-AR')}
              </span>
              <PaymentStateBadge account={account} className="text-xs px-2.5 py-1" />
            </div>
          </button>
        );
      })}
    </>
  );
}
