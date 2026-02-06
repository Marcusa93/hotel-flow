import { Guest } from '@/types/hotel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, ArrowUpRight, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface GuestCardProps {
    guest: Guest;
    bookingsCount: number;
    totalSpend: number; // Mocked or calculated
    onClick: () => void;
}

export function GuestCard({ guest, bookingsCount, totalSpend, onClick }: GuestCardProps) {
    // Mock logic for VIP status based on spend/stays (could be real in future)
    const isVip = bookingsCount > 3 || totalSpend > 5000;

    return (
        <motion.div
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
        >
            <div
                onClick={onClick}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all cursor-pointer h-full flex flex-col"
            >
                {/* VIP Gradient Ring Effect */}
                {isVip && (
                    <div className="absolute top-0 right-0 p-4">
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 gap-1 rounded-full px-3">
                            <Crown className="w-3 h-3 fill-amber-700" /> VIP
                        </Badge>
                    </div>
                )}

                <div className="flex flex-col items-center text-center mb-6">
                    <div className={cn(
                        "p-1 rounded-full mb-3",
                        isVip ? "bg-gradient-to-tr from-amber-300 via-yellow-400 to-orange-400 p-[3px]" : "bg-slate-100"
                    )}>
                        <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-900 shadow-sm bg-white">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${guest.email}`} />
                            <AvatarFallback className="text-xl bg-slate-100 text-slate-500 font-bold">
                                {guest.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">
                        {guest.fullName}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        Desde {format(new Date(guest.createdAt), 'MMM yyyy')}
                    </p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6 w-full">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Visitas</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{bookingsCount}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Gasto Total</p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            ${(totalSpend / 1000).toFixed(1)}k
                        </p>
                    </div>
                </div>

                {/* Contact Actions (Opacity on Hover) */}
                <div className="mt-auto grid grid-cols-2 gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" className="w-full rounded-xl h-9">
                        <Mail className="w-3.5 h-3.5 mr-2" /> Email
                    </Button>
                    <Button variant="outline" size="sm" className="w-full rounded-xl h-9">
                        <Phone className="w-3.5 h-3.5 mr-2" /> Llama
                    </Button>
                </div>

                {/* Arrow Action */}
                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
