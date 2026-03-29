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
import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Search, Users, BedDouble, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Guests() {
  const { guests } = useGuestOperations();
  const { bookings } = useBookingOperations();
  const { data: hotelSettings } = useHotelSettings();
  const hotelName = hotelSettings?.hotelName || 'Hotel';
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [quickFilter, setQuickFilter] = useState<'all' | 'hosted' | 'vip'>('all');
  const [selectedGuest, setSelectedGuest] = useState<Guest | undefined>(undefined);
  const [isNewGuestDialogOpen, setIsNewGuestDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsNewGuestDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // VIP guest IDs (5+ bookings)
  const vipGuestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, stats] of Object.entries(guestStatsMap)) {
      if (stats.bookingsCount >= 5) ids.add(id);
    }
    return ids;
  }, [guestStatsMap]);

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
      if (quickFilter === 'vip' && !vipGuestIds.has(guest.id)) return false;

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
  }, [guests, search, sortBy, quickFilter, guestStatsMap, hostedGuestIds, vipGuestIds]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex-none px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <GuestsHeader
          guestCount={guests.length}
          guests={guests}
          hotelName={hotelName}
          onNewGuest={() => setIsNewGuestDialogOpen(true)}
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
            color="emerald"
          />
          <FilterChip
            active={quickFilter === 'vip'}
            onClick={() => setQuickFilter('vip')}
            icon={Star}
            label={`VIP (${vipGuestIds.size})`}
            color="amber"
          />
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredGuests.length} resultado{filteredGuests.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-2 px-4 md:px-6 relative">
        <div className="fixed inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10 pointer-events-none" />

        {filteredGuests.length === 0 ? (
          <div className="mt-20">
            <EmptyState
              icon={Search}
              title="No se encontraron huéspedes"
              description={search ? "Intenta ajustar la búsqueda" : "Aún no hay huéspedes registrados"}
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
  active, onClick, icon: Icon, label, color = 'slate'
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  color?: 'slate' | 'emerald' | 'amber';
}) {
  const colors = {
    slate: active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    emerald: active ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    amber: active ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:shadow-sm',
        colors[color],
        active ? 'border-transparent shadow-sm' : 'border-slate-200 dark:border-slate-700'
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
