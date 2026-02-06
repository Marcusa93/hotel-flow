import { Room, RoomStatus, Guest } from '@/types/hotel';
import { RoomCard } from './RoomCard';
import { motion } from 'framer-motion';

interface RoomGridProps {
    rooms: Room[];
    roomTypes: any[];
    guests: Guest[];
    bookings: any[];
    onRoomClick: (room: Room) => void;
    onQuickAction: (room: Room, action: 'clean' | 'occupy') => void;
}

export function RoomGrid({ rooms, roomTypes, guests, bookings, onRoomClick, onQuickAction }: RoomGridProps) {

    const getGuest = (roomId: string) => {
        const activeBooking = bookings.find(b => b.roomId === roomId && (b.status === 'CHECKED_IN'));
        return activeBooking ? guests.find(g => g.id === activeBooking.guestId) : undefined;
    };

    const getType = (typeId: string) => roomTypes.find(rt => rt.id === typeId)?.name;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
            {rooms.map((room, index) => (
                <motion.div
                    key={room.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <RoomCard
                        room={room}
                        roomTypeName={getType(room.roomTypeId)}
                        guest={getGuest(room.id)}
                        onClick={() => onRoomClick(room)}
                        onQuickAction={(action) => onQuickAction(room, action)}
                    />
                </motion.div>
            ))}
        </div>
    );
}
