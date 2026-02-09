import { useState, useEffect, useRef } from 'react';
import { Bell, X, ChevronRight, Volume2 } from 'lucide-react';
import { HousekeepingTask, Room } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TaskAlertBannerProps {
    newTasks: HousekeepingTask[];
    rooms: Room[];
    onDismiss: () => void;
    onViewTask: (task: HousekeepingTask) => void;
    enableSound?: boolean;
}

export function TaskAlertBanner({ newTasks, rooms, onDismiss, onViewTask, enableSound = true }: TaskAlertBannerProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasPlayedSound, setHasPlayedSound] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Get checkout tasks (highest priority)
    const checkoutTasks = newTasks.filter(t => t.priority === 'CHECKOUT' && t.status === 'TODO');
    const urgentTasks = newTasks.filter(t => t.priority === 'URGENT' && t.status === 'TODO');
    const displayTasks = checkoutTasks.length > 0 ? checkoutTasks : urgentTasks;

    useEffect(() => {
        if (displayTasks.length > 0) {
            setIsVisible(true);

            // Play notification sound
            if (enableSound && !hasPlayedSound) {
                playNotificationSound();
                setHasPlayedSound(true);

                // Request browser notification permission
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission();
                }

                // Show browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    const room = displayTasks[0] ? rooms.find(r => r.id === displayTasks[0].roomId) : null;
                    new Notification('🧹 Nueva tarea de limpieza', {
                        body: `Habitación ${room?.roomNumber || ''} requiere limpieza${checkoutTasks.length > 0 ? ' (CHECKOUT)' : ''}`,
                        icon: '/favicon.ico',
                        tag: 'housekeeping-alert',
                        requireInteraction: true,
                    });
                }
            }
        } else {
            setIsVisible(false);
            setHasPlayedSound(false);
        }
    }, [displayTasks.length, enableSound, hasPlayedSound, rooms, checkoutTasks.length]);

    const playNotificationSound = () => {
        // Create audio context for notification sound
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create a pleasant notification sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Audio notification not available');
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss();
    };

    if (!isVisible || displayTasks.length === 0) {
        return null;
    }

    const firstTask = displayTasks[0];
    const firstRoom = rooms.find(r => r.id === firstTask.roomId);
    const isCheckout = checkoutTasks.length > 0;

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-50 p-4 safe-area-inset-top",
                "animate-in slide-in-from-top duration-300"
            )}
        >
            <div
                className={cn(
                    "rounded-2xl shadow-2xl overflow-hidden",
                    isCheckout
                        ? "bg-gradient-to-r from-rose-500 to-pink-600"
                        : "bg-gradient-to-r from-amber-500 to-orange-500"
                )}
            >
                <div className="p-4 flex items-center gap-3">
                    {/* Icon */}
                    <div className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0",
                        isCheckout ? "bg-white/20" : "bg-white/20"
                    )}>
                        <Bell className="w-6 h-6 text-white animate-bounce" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-lg">
                            {isCheckout ? '🚨 ¡CHECKOUT!' : '⚡ Nueva Tarea'}
                        </p>
                        <p className="text-white/90 text-sm truncate">
                            Habitación {firstRoom?.roomNumber || '?'}
                            {displayTasks.length > 1 && ` (+${displayTasks.length - 1} más)`}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDismiss}
                            className="text-white/70 hover:text-white hover:bg-white/20"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Action Bar */}
                <button
                    onClick={() => onViewTask(firstTask)}
                    className={cn(
                        "w-full py-3 px-4 flex items-center justify-between",
                        isCheckout ? "bg-white/10" : "bg-white/10",
                        "hover:bg-white/20 transition-colors"
                    )}
                >
                    <span className="text-white font-medium flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Ver tarea
                    </span>
                    <ChevronRight className="w-5 h-5 text-white" />
                </button>
            </div>
        </div>
    );
}
