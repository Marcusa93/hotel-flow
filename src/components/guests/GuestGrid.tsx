import { Guest, Booking } from '@/types/hotel';
import { GuestCard } from './GuestCard';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface GuestGridProps {
    guests: Guest[];
    bookings: Booking[];
    onGuestClick: (guest: Guest) => void;
    getGuestStats: (guestId: string) => { bookingsCount: number; totalSpend: number };
}

export function GuestGrid({ guests, bookings, onGuestClick, getGuestStats }: GuestGridProps) {
    // Pre-compute hosted status and last checkout for all guests
    const guestExtras = useMemo(() => {
        const hosted = new Set<string>();
        const lastCheckout = new Map<string, Date>();

        for (const b of bookings) {
            if (b.status === 'CHECKED_IN') {
                hosted.add(b.guestId);
            }
            if (b.status === 'CHECKED_OUT' && b.checkOutDate) {
                const date = new Date(b.checkOutDate);
                const existing = lastCheckout.get(b.guestId);
                if (!existing || date > existing) {
                    lastCheckout.set(b.guestId, date);
                }
            }
        }
        return { hosted, lastCheckout };
    }, [bookings]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {guests.map((guest, index) => {
                const stats = getGuestStats(guest.id);
                return (
                    <motion.div
                        key={guest.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                    >
                        <GuestCard
                            guest={guest}
                            bookingsCount={stats.bookingsCount}
                            totalSpend={stats.totalSpend}
                            isCurrentlyHosted={guestExtras.hosted.has(guest.id)}
                            lastCheckout={guestExtras.lastCheckout.get(guest.id) || null}
                            onClick={() => onGuestClick(guest)}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}
