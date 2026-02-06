import { useState, useMemo } from 'react';
import { useHotel } from '@/context/HotelContext';
import { Guest } from '@/types/hotel';
import {
  GuestsHeader,
  GuestsFilters,
  GuestGrid,
  GuestDetailsDrawer
} from '@/components/guests';
import { EmptyState } from '@/components/shared';
import { Search } from 'lucide-react';

export default function Guests() {
  const { guests, bookings } = useHotel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('recent');
  const [selectedGuest, setSelectedGuest] = useState<Guest | undefined>(undefined);

  // Stats Helper
  const getGuestStats = (guestId: string) => {
    const guestBookings = bookings.filter(b => b.guestId === guestId);
    const totalSpend = guestBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    return { bookingsCount: guestBookings.length, totalSpend };
  };

  const filteredGuests = useMemo(() => {
    let result = guests.filter(guest => {
      const searchLower = search.toLowerCase();
      return (
        guest.fullName.toLowerCase().includes(searchLower) ||
        guest.email.toLowerCase().includes(searchLower) ||
        guest.phone.includes(search) ||
        (guest.documentId || '').toLowerCase().includes(searchLower)
      );
    });

    // Sorting Logic
    if (statusFilter === 'name_asc') {
      result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (statusFilter === 'spend_desc') {
      result.sort((a, b) => {
        const spendA = getGuestStats(a.id).totalSpend;
        const spendB = getGuestStats(b.id).totalSpend;
        return spendB - spendA;
      });
    } else {
      // Default: Recent
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [guests, search, statusFilter, bookings]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Header Section */}
      <div className="flex-none px-6 pt-6 pb-2">
        <GuestsHeader
          guestCount={guests.length}
          onNewGuest={() => {/* Todo: Open New Guest Modal */ }}
        />
        <GuestsFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4 px-6 relative">
        {/* Background Decoration */}
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
            onGuestClick={setSelectedGuest}
            getGuestStats={getGuestStats}
          />
        )}
      </div>

      {/* Details Drawer */}
      <GuestDetailsDrawer
        isOpen={!!selectedGuest}
        onClose={() => setSelectedGuest(undefined)}
        guest={selectedGuest}
      />
    </div>
  );
}
