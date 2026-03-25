import { Guest } from '@/types/hotel';
import { GuestCard } from './GuestCard';
import { motion } from 'framer-motion';

interface GuestGridProps {
    guests: Guest[];
    onGuestClick: (guest: Guest) => void;
    getGuestStats: (guestId: string) => { bookingsCount: number; totalSpend: number };
}

export function GuestGrid({ guests, onGuestClick, getGuestStats }: GuestGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {guests.map((guest, index) => {
                const stats = getGuestStats(guest.id);
                return (
                    <motion.div
                        key={guest.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <GuestCard
                            guest={guest}
                            bookingsCount={stats.bookingsCount}
                            totalSpend={stats.totalSpend}
                            onClick={() => onGuestClick(guest)}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}
