import { Guest } from '@/types/hotel';
import { Calendar, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface GuestCardProps {
    guest: Guest;
    bookingsCount: number;
    totalSpend: number;
    onClick: () => void;
}

export function GuestCard({ guest, bookingsCount, totalSpend, onClick }: GuestCardProps) {
    const initials = guest.fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <motion.div
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
        >
            <div
                onClick={onClick}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-2xl hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 transition-all cursor-pointer h-full flex flex-col"
            >
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-3 shadow-lg">
                        <span className="text-2xl font-bold text-white">{initials}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">
                        {guest.fullName}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Desde {format(new Date(guest.createdAt), 'MMM yyyy')}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-slate-200/50 dark:border-slate-700/50">
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-1">Visitas</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{bookingsCount}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-slate-200/50 dark:border-slate-700/50">
                        <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-1">Gasto Total</p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            ${(totalSpend / 1000).toFixed(1)}k
                        </p>
                    </div>
                </div>

                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
