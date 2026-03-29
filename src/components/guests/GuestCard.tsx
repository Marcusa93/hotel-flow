import { Guest } from '@/types/hotel';
import { Calendar, Phone, Globe, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GuestCardProps {
    guest: Guest;
    bookingsCount: number;
    totalSpend: number;
    isCurrentlyHosted?: boolean;
    lastCheckout?: Date | null;
    onClick: () => void;
}

export function GuestCard({ guest, bookingsCount, totalSpend, isCurrentlyHosted, lastCheckout, onClick }: GuestCardProps) {
    const initials = guest.fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    // Guest tier based on visits
    const tier = bookingsCount >= 5 ? 'vip' : bookingsCount >= 2 ? 'regular' : 'new';
    const tierColors = {
        vip: 'from-amber-500 to-orange-600',
        regular: 'from-indigo-500 to-violet-600',
        new: 'from-slate-400 to-slate-500',
    };

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
                        tierColors[tier],
                        isCurrentlyHosted && "ring-2 ring-emerald-400 ring-offset-2"
                    )}>
                        <span className="text-sm font-bold text-white">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                            {guest.fullName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {guest.country && (
                                <span className="flex items-center gap-0.5">
                                    <Globe className="w-3 h-3" />
                                    {guest.country}
                                </span>
                            )}
                            {guest.phone && (
                                <span className="flex items-center gap-0.5 truncate">
                                    <Phone className="w-3 h-3" />
                                    {guest.phone}
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
                        <span className="text-muted-foreground">visitas</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold">${totalSpend > 1000 ? `${(totalSpend / 1000).toFixed(0)}k` : totalSpend.toLocaleString()}</span>
                    </div>
                    {tier === 'vip' && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[10px] h-5 px-1.5">
                            VIP
                        </Badge>
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
