import { Guest } from '@/types/hotel';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, ArrowUpRight, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface GuestCardProps {
    guest: Guest;
    bookingsCount: number;
    totalSpend: number;
    onClick: () => void;
    onWhatsApp?: (guest: Guest) => void;
    onEmail?: (guest: Guest) => void;
}

export function GuestCard({ guest, bookingsCount, totalSpend, onClick, onWhatsApp, onEmail }: GuestCardProps) {
    // Get initials for display
    const initials = guest.fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onWhatsApp) {
            onWhatsApp(guest);
        } else {
            // Default WhatsApp behavior
            const message = encodeURIComponent(
                `Hola! ${guest.fullName} somos del Hotel Metropolitano. Nos comunicamos contigo por lo siguiente:`
            );
            const phone = guest.phone.replace(/\D/g, ''); // Remove non-digits
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        }
    };

    const handleEmail = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEmail) {
            onEmail(guest);
        } else {
            // Default mailto
            window.open(`mailto:${guest.email}?subject=Hotel Metropolitano - Información`, '_blank');
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
        >
            <div
                onClick={onClick}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all cursor-pointer h-full flex flex-col"
            >
                <div className="flex flex-col items-center text-center mb-6">
                    {/* Initials Circle (no avatar) */}
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

                {/* Contact Actions */}
                <div className="mt-auto grid grid-cols-2 gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl h-9 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                        onClick={handleWhatsApp}
                    >
                        <MessageCircle className="w-3.5 h-3.5 mr-2" />
                        WhatsApp
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl h-9 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                        onClick={handleEmail}
                    >
                        <Mail className="w-3.5 h-3.5 mr-2" />
                        Email
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
