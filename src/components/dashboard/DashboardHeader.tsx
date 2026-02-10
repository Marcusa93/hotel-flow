import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Sun, Moon, CloudSun } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardHeaderProps {
    onNewBooking: () => void;
    todayCheckIns?: number;
    todayCheckOuts?: number;
}

export function DashboardHeader({ onNewBooking, todayCheckIns = 0, todayCheckOuts = 0 }: DashboardHeaderProps) {
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white shadow-2xl">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/10 backdrop-blur">
                            <GreetingIcon className="w-5 h-5 text-amber-300" />
                        </div>
                        <span className="text-sm font-medium text-white/70">{greeting}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                        Hotel Mediterráneo
                    </h1>
                    <p className="text-white/60 text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(currentTime, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Live Clock - Argentina Timezone */}
                    <div className="px-5 py-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur border border-white/10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                        <p className="text-[10px] text-white/50 uppercase tracking-widest mb-1 text-center">Argentina</p>
                        <div className="flex items-center gap-1 font-mono">
                            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                                {hours}
                            </span>
                            <span className="text-2xl md:text-3xl font-bold text-purple-400 animate-pulse">:</span>
                            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                                {minutes}
                            </span>
                            <span className="text-lg text-white/40 font-medium ml-1">
                                :{seconds}
                            </span>
                        </div>
                    </div>

                    {/* Today's Summary */}
                    <div className="flex gap-3">
                        <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10">
                            <p className="text-xs text-white/60 mb-0.5">Check-ins hoy</p>
                            <p className="text-xl font-bold text-emerald-400">{todayCheckIns}</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10">
                            <p className="text-xs text-white/60 mb-0.5">Check-outs hoy</p>
                            <p className="text-xl font-bold text-amber-400">{todayCheckOuts}</p>
                        </div>
                    </div>

                    <Button
                        onClick={onNewBooking}
                        size="lg"
                        className="rounded-xl px-6 shadow-lg bg-white text-slate-900 hover:bg-white/90 font-semibold"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nueva Reserva
                    </Button>
                </div>
            </div>
        </div>
    );
}
