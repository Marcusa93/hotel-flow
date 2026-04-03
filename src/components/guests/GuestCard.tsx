import { Guest } from '@/types/hotel';
import { Calendar, Phone, Globe, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn, formatLastNameFirst, getInitials } from '@/lib/utils';

interface GuestCardProps {
    guest: Guest;
    bookingsCount: number;
    totalSpend: number;
    isCurrentlyHosted?: boolean;
    lastCheckout?: Date | null;
    onClick: () => void;
}

export function GuestCard({ guest, bookingsCount, totalSpend, isCurrentlyHosted, lastCheckout, onClick }: GuestCardProps) {
    const initials = getInitials(guest.fullName);
    const displayName = formatLastNameFirst(guest.fullName);

    // Color by frequency
    const avatarColor = bookingsCount >= 3 ? 'from-indigo-500 to-violet-600'
        : bookingsCount >= 1 ? 'from-blue-400 to-indigo-500'
        : 'from-slate-400 to-slate-500';

    return (
        <motion.div
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            className="group relative"
        >
            <button
                onClick={onClick}
                className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all cursor-pointer h-full flex flex-col"
            >
                {/* Header row */}
                <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br",
                        avatarColor,
                        isCurrentlyHosted && "ring-2 ring-emerald-400 ring-offset-2"
                    )}>
                        <span className="text-sm font-bold text-white">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                            {displayName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {guest.phone && (
                                <span className="flex items-center gap-0.5 truncate">
                                    <Phone className="w-3 h-3" />
                                    {guest.phone}
                                </span>
                            )}
                            {guest.country && (
                                <span className="flex items-center gap-0.5">
                                    <Globe className="w-3 h-3" />
                                    {guest.country}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 text-xs bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                        <BedDouble className="w-3 h-3 text-muted-foreground" />
                        <span className="font-bold">{bookingsCount}</span>
                        <span className="text-muted-foreground">{bookingsCount === 1 ? 'visita' : 'visitas'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold">${totalSpend > 1000 ? `${(totalSpend / 1000).toFixed(0)}k` : totalSpend.toLocaleString()}</span>
                    </div>
                    {bookingsCount >= 3 && (
                        <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-md">
                            Frecuente
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                    {isCurrentlyHosted ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Hospedado ahora
                        </span>
                    ) : lastCheckout ? (
                        <span>Última visita: {format(lastCheckout, 'dd/MM/yy')}</span>
                    ) : (
                        <span>Registrado {format(new Date(guest.createdAt), 'dd/MM/yy')}</span>
                    )}
                    <Calendar className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </button>
        </motion.div>
    );
}
