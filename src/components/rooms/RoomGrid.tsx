import { Room, RoomType, Booking, Guest } from '@/types/hotel';
import { RoomCard } from './RoomCard';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface RoomGridProps {
    rooms: Room[];
    roomTypes: RoomType[];
    guests: Guest[];
    bookings: Booking[];
    onRoomClick: (room: Room) => void;
    onQuickAction: (room: Room, action: 'clean' | 'occupy') => void;
    selectedIds?: Set<string>;
}

export function RoomGrid({ rooms, roomTypes, guests, bookings, onRoomClick, onQuickAction, selectedIds }: RoomGridProps) {

    const getGuest = (roomId: string) => {
        const activeBooking = bookings.find(b => b.roomId === roomId && (b.status === 'CHECKED_IN'));
        return activeBooking ? guests.find(g => g.id === activeBooking.guestId) : undefined;
    };

    const getType = (typeId: string) => {
        const rt = roomTypes.find(rt => rt.id === typeId);
        return rt ? `${rt.maxGuests} personas` : undefined;
    };

    const isBulkMode = !!selectedIds;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
            {rooms.map((room, index) => {
                const isSelected = selectedIds?.has(room.id);
                return (
                    <motion.div
                        key={room.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="relative"
                    >
                        {/* Selection indicator */}
                        {isBulkMode && (
                            <div className={cn(
                                'absolute -top-1 -right-1 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                                isSelected
                                    ? 'bg-primary border-primary text-white scale-110'
                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                            )}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                        )}
                        <div className={cn(
                            isBulkMode && isSelected && 'ring-2 ring-primary ring-offset-2 rounded-2xl',
                        )}>
                            <RoomCard
                                room={room}
                                roomTypeName={getType(room.roomTypeId)}
                                guest={getGuest(room.id)}
                                onClick={() => onRoomClick(room)}
                                onQuickAction={(action) => onQuickAction(room, action)}
                            />
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
