import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { Guest } from '@/types/hotel';
import {
  GuestsHeader,
  GuestsFilters,
  GuestGrid,
  GuestDetailsDrawer
} from '@/components/guests';
import { NewGuestDialog } from '@/components/guests/NewGuestDialog';
import { EmptyState, ListSkeleton } from '@/components/shared';
import { Search, Users, BedDouble, Repeat, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Guests() {
  const { guests, isLoading: isLoadingGuests } = useGuestOperations();
  const { bookings } = useBookingOperations();
  const { data: hotelSettings } = useHotelSettings();
  const hotelName = hotelSettings?.hotelName || 'Hotel';
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [quickFilter, setQuickFilter] = useState<'all' | 'hosted' | 'frequent' | 'new'>('all');
  const [selectedGuest, setSelectedGuest] = useState<Guest | undefined>(undefined);
  const [isNewGuestDialogOpen, setIsNewGuestDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsNewGuestDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
    const openId = searchParams.get('open');
    if (openId && guests.length > 0) {
      const guest = guests.find(g => g.id === openId);
      if (guest) {
        setSelectedGuest(guest);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, guests]);

  // Precompute guest stats
  const guestStatsMap = useMemo(() => {
    const map: Record<string, { bookingsCount: number; totalSpend: number }> = {};
    for (const b of bookings) {
      if (!map[b.guestId]) map[b.guestId] = { bookingsCount: 0, totalSpend: 0 };
      map[b.guestId].bookingsCount++;
      map[b.guestId].totalSpend += b.totalAmount;
    }
    return map;
  }, [bookings]);

  // Currently hosted guest IDs
  const hostedGuestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of bookings) {
      if (b.status === 'CHECKED_IN') ids.add(b.guestId);
    }
    return ids;
  }, [bookings]);

  // Frequent guest IDs (3+ bookings)
  const frequentGuestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, stats] of Object.entries(guestStatsMap)) {
      if (stats.bookingsCount >= 3) ids.add(id);
    }
    return ids;
  }, [guestStatsMap]);

  // New guest IDs (1 booking only)
  const newGuestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, stats] of Object.entries(guestStatsMap)) {
      if (stats.bookingsCount <= 1) ids.add(id);
    }
    // Also include guests with 0 bookings
    for (const g of guests) {
      if (!guestStatsMap[g.id]) ids.add(g.id);
    }
    return ids;
  }, [guestStatsMap, guests]);

  const getGuestStats = (guestId: string) =>
    guestStatsMap[guestId] || { bookingsCount: 0, totalSpend: 0 };

  const filteredGuests = useMemo(() => {
    let result = guests.filter(guest => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        guest.fullName.toLowerCase().includes(searchLower) ||
        (guest.email || '').toLowerCase().includes(searchLower) ||
        guest.phone.includes(search) ||
        (guest.documentId || '').toLowerCase().includes(searchLower);

      // Quick filters
      if (quickFilter === 'hosted' && !hostedGuestIds.has(guest.id)) return false;
      if (quickFilter === 'frequent' && !frequentGuestIds.has(guest.id)) return false;
      if (quickFilter === 'new' && !newGuestIds.has(guest.id)) return false;

      return matchesSearch;
    });

    // Sorting
    if (sortBy === 'name_asc') {
      result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (sortBy === 'spend_desc') {
      result.sort((a, b) => (guestStatsMap[b.id]?.totalSpend || 0) - (guestStatsMap[a.id]?.totalSpend || 0));
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [guests, search, sortBy, quickFilter, guestStatsMap, hostedGuestIds, frequentGuestIds, newGuestIds]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex-none px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <GuestsHeader
          guestCount={guests.length}
          guests={guests}
          hotelName={hotelName}
          onNewGuest={() => setIsNewGuestDialogOpen(true)}
          hostedCount={hostedGuestIds.size}
          frequentCount={frequentGuestIds.size}
          totalSpend={Object.values(guestStatsMap).reduce((s, g) => s + g.totalSpend, 0)}
        />
        <GuestsFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={sortBy}
          onStatusFilterChange={setSortBy}
        />

        {/* Quick filter chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <FilterChip
            active={quickFilter === 'all'}
            onClick={() => setQuickFilter('all')}
            icon={Users}
            label={`Todos (${guests.length})`}
          />
          <FilterChip
            active={quickFilter === 'hosted'}
            onClick={() => setQuickFilter('hosted')}
            icon={BedDouble}
            label={`Hospedados (${hostedGuestIds.size})`}
          />
          <FilterChip
            active={quickFilter === 'frequent'}
            onClick={() => setQuickFilter('frequent')}
            icon={Repeat}
            label={`Frecuentes (${frequentGuestIds.size})`}
          />
          <FilterChip
            active={quickFilter === 'new'}
            onClick={() => setQuickFilter('new')}
            icon={UserPlus}
            label={`Nuevos (${newGuestIds.size})`}
          />
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredGuests.length} resultado{filteredGuests.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-2 px-4 md:px-6 relative">
        <div className="fixed inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10 pointer-events-none" />

        {isLoadingGuests && guests.length === 0 ? (
          <div className="mt-6">
            <ListSkeleton items={6} />
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="mt-20">
            <EmptyState
              icon={search ? Search : UserPlus}
              title={search ? "No se encontraron huéspedes" : "Aún no hay huéspedes"}
              description={search
                ? "Probá con otro nombre, email o documento."
                : "Registrá al primer huésped para empezar a gestionar reservas."}
              action={
                search
                  ? { label: 'Limpiar búsqueda', onClick: () => setSearch('') }
                  : { label: 'Nuevo huésped', onClick: () => setIsNewGuestDialogOpen(true) }
              }
            />
          </div>
        ) : (
          <GuestGrid
            guests={filteredGuests}
            bookings={bookings}
            onGuestClick={setSelectedGuest}
            getGuestStats={getGuestStats}
          />
        )}
      </div>

      <GuestDetailsDrawer
        isOpen={!!selectedGuest}
        onClose={() => setSelectedGuest(undefined)}
        guest={selectedGuest}
        onDeleted={() => setSelectedGuest(undefined)}
      />

      <NewGuestDialog
        open={isNewGuestDialogOpen}
        onOpenChange={setIsNewGuestDialogOpen}
      />
    </div>
  );
}

function FilterChip({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800/50 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700/50',
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
