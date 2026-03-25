import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Sun, Moon, CloudSun } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardHeaderProps {
    onNewBooking: () => void;
    onCheckInsClick?: () => void;
    onCheckOutsClick?: () => void;
    todayCheckIns?: number;
    todayCheckOuts?: number;
    hotelName?: string;
    timezone?: string;
}

/** Extract a short display label from IANA timezone (e.g. "America/Argentina/Buenos_Aires" → "Argentina") */
function timezoneLabel(tz?: string): string {
    if (!tz) return 'Hora local';
    const parts = tz.split('/');
    return (parts[1] ?? parts[0]).replace(/_/g, ' ');
}

export function DashboardHeader({ onNewBooking, onCheckInsClick, onCheckOutsClick, todayCheckIns = 0, todayCheckOuts = 0, hotelName = 'Hotel', timezone }: DashboardHeaderProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const hour = currentTime.getHours();

    let greeting = 'Hola';
    let GreetingIcon = Sun;
    if (hour < 12) {
        greeting = 'Buenos días';
        GreetingIcon = Sun;
    } else if (hour < 20) {
        greeting = 'Buenas tardes';
        GreetingIcon = CloudSun;
    } else {
        greeting = 'Buenas noches';
        GreetingIcon = Moon;
    }

    // Format time components for animated display
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getSeconds().toString().padStart(2, '0');

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1628] via-[#112240] to-[#0a1628] p-6 md:p-8 text-white shadow-2xl">
            {/* Decorative Elements — gold/amber tones */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-amber-600/10 to-amber-400/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/15 backdrop-blur border border-amber-500/10">
                            <GreetingIcon className="w-5 h-5 text-amber-300" />
                        </div>
                        <span className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-medium">{greeting}</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-light tracking-wide">
                        {hotelName}
                    </h1>
                    <p className="text-white/50 text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(currentTime, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Live Clock */}
                    <div className="px-5 py-3 rounded-xl bg-white/5 backdrop-blur border border-amber-500/20 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                        <p className="text-[10px] text-amber-400/60 uppercase tracking-widest mb-1 text-center">{timezoneLabel(timezone)}</p>
                        <div className="flex items-center gap-1 font-mono">
                            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                                {hours}
                            </span>
                            <span className="text-2xl md:text-3xl font-bold text-amber-400 animate-pulse">:</span>
                            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                                {minutes}
                            </span>
                            <span className="text-lg text-white/40 font-medium ml-1">
                                :{seconds}
                            </span>
                        </div>
                    </div>

                    {/* Today's Summary — clickable */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCheckInsClick}
                            className="px-4 py-2 rounded-xl bg-white/5 backdrop-blur border border-amber-500/15 text-left transition-all hover:bg-white/10 hover:border-emerald-400/40 hover:scale-105 active:scale-95"
                        >
                            <p className="text-xs text-white/50 mb-0.5">Check-ins hoy</p>
                            <p className="text-xl font-bold text-emerald-400">{todayCheckIns}</p>
                        </button>
                        <button
                            onClick={onCheckOutsClick}
                            className="px-4 py-2 rounded-xl bg-white/5 backdrop-blur border border-amber-500/15 text-left transition-all hover:bg-white/10 hover:border-amber-400/40 hover:scale-105 active:scale-95"
                        >
                            <p className="text-xs text-white/50 mb-0.5">Check-outs hoy</p>
                            <p className="text-xl font-bold text-amber-400">{todayCheckOuts}</p>
                        </button>
                    </div>

                    <Button
                        onClick={onNewBooking}
                        size="lg"
                        className="rounded-xl px-6 shadow-lg bg-amber-500 hover:bg-amber-600 hover:shadow-xl text-slate-900 font-semibold shadow-amber-500/20 active:scale-95 transition-all"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nueva Reserva
                    </Button>
                </div>
            </div>
        </div>
    );
}
