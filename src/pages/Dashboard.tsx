import { useMemo, useState } from 'react';
import { useDashboardStats } from '@/hooks/domain/useDashboardStats';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useAppRole } from '@/context/AppRoleContext';
import {
  RoomStatusMap,
  OperationalAlerts,
  RevenueChart,
  UpcomingArrivalsWidget,
  AIBriefing,
  AIInsights,
} from '@/components/dashboard';
import { NewBookingDialog } from '@/components/bookings/NewBookingDialog';
import { NewGuestDialog } from '@/components/guests/NewGuestDialog';
import { NewPaymentDialog } from '@/components/payments/NewPaymentDialog';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sun, Moon, CloudSun, CalendarPlus, UserPlus, CreditCard, Sparkles,
  BedDouble, TrendingUp, Users, DollarSign, LogIn, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogKey = 'booking' | 'guest' | 'payment' | null;

export default function Dashboard() {
  const { stats } = useDashboardStats();
  const { rooms, roomTypes } = useRoomOperations();
  const { guests } = useGuestOperations();
  const { bookings } = useBookingOperations();
  const { data: hotelSettings } = useHotelSettings();
  const { payments } = usePaymentOperations();
  const { currentRole } = useAppRole();
  const navigate = useNavigate();

  const [openDialog, setOpenDialog] = useState<DialogKey>(null);

  // Today stats
  const { todayCheckIns, todayCheckOuts } = useMemo(() => {
    const checkIns = bookings.filter(b => {
      return isToday(new Date(b.checkInDate)) && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
    }).length;
    const checkOuts = bookings.filter(b => {
      return isToday(new Date(b.checkOutDate)) && b.status === 'CHECKED_IN';
    }).length;
    return { todayCheckIns: checkIns, todayCheckOuts: checkOuts };
  }, [bookings]);

  // ADR
  const adr = useMemo(() => {
    const recent = bookings.filter(b => b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT');
    if (recent.length === 0) return 0;
    const totalRevenue = recent.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalNights = recent.reduce((sum, b) => {
      const nights = Math.ceil(
        (new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + nights;
    }, 0);
    return totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0;
  }, [bookings]);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const GreetingIcon = hour < 12 ? Sun : hour < 20 ? CloudSun : Moon;

  const canDoActions = currentRole === 'admin' || currentRole === 'reception';
  const canHousekeeping = currentRole === 'admin' || currentRole === 'housekeeping';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto px-4 md:px-6 py-6 pb-20 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full space-y-5">

        {/* ── COMPACT HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-900/80 dark:to-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 shadow-sm">
                <GreetingIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{greeting}</p>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {hotelSettings?.hotelName || 'Hotel'}
                </h1>
              </div>
              <span className="text-xs text-muted-foreground/70 ml-2 hidden sm:block capitalize">
                {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
              </span>
            </div>

            {/* Quick actions inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {canDoActions && (
                <>
                  <Button size="sm" className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold shadow-sm" onClick={() => setOpenDialog('booking')}>
                    <CalendarPlus className="w-4 h-4 mr-1.5" /> Reserva
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setOpenDialog('guest')}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Huésped
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setOpenDialog('payment')}>
                    <CreditCard className="w-4 h-4 mr-1.5" /> Pago
                  </Button>
                </>
              )}
              {canHousekeeping && (
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate('/housekeeping')}>
                  <Sparkles className="w-4 h-4 mr-1.5" /> Limpieza
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── TODAY BAR: check-ins, check-outs, occupancy ── */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat
              icon={BedDouble} label="Ocupación"
              value={`${stats.occupancyRate.toFixed(0)}%`}
              sub={`${stats.occupiedRooms}/${stats.totalRooms} hab.`}
              color="blue"
            />
            <MiniStat
              icon={LogIn} label="Check-ins hoy"
              value={todayCheckIns}
              sub="llegadas"
              color="emerald"
              onClick={() => navigate('/bookings?filter=checkin-today')}
            />
            <MiniStat
              icon={LogOut} label="Check-outs hoy"
              value={todayCheckOuts}
              sub="salidas"
              color="amber"
              onClick={() => navigate('/bookings?filter=checkout-today')}
            />
            <MiniStat
              icon={DollarSign} label="Ingresos mes"
              value={`$${(stats.monthlyRevenue / 1000).toFixed(0)}k`}
              sub={`ADR $${adr.toLocaleString()}`}
              color="violet"
            />
          </div>
        </motion.div>

        {/* ── AI BRIEFING — resumen del día ── */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <AIBriefing bookings={bookings} rooms={rooms} guests={guests} payments={payments} />
        </motion.div>

        {/* ── OPERATIONAL ALERTS ── */}
        <OperationalAlerts rooms={rooms} bookings={bookings} payments={payments} />

        {/* ── ROOM MAP — HERO ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <RoomStatusMap rooms={rooms} bookings={bookings} guests={guests} roomTypes={roomTypes} />
        </motion.div>

        {/* ── AI INSIGHTS — alertas predictivas + revenue ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <AIInsights
            bookings={bookings}
            rooms={rooms}
            payments={payments}
            guests={guests}
            monthlyRevenue={stats.monthlyRevenue}
            occupancyRate={stats.occupancyRate}
          />
        </motion.div>

        {/* ── BOTTOM GRID: Revenue + Arrivals ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <RevenueChart />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <UpcomingArrivalsWidget />
          </motion.div>
        </div>
      </div>

      {/* Inline Dialogs */}
      <NewBookingDialog open={openDialog === 'booking'} onOpenChange={(open) => !open && setOpenDialog(null)} />
      <NewGuestDialog open={openDialog === 'guest'} onOpenChange={(open) => !open && setOpenDialog(null)} />
      <NewPaymentDialog open={openDialog === 'payment'} onOpenChange={(open) => !open && setOpenDialog(null)} />
    </div>
  );
}

/* ── Mini Stat Card ── */
function MiniStat({
  icon: Icon, label, value, sub, color, onClick,
}: {
  icon: typeof BedDouble; label: string; value: string | number; sub: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
  onClick?: () => void;
}) {
  const colors = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200/50 dark:ring-blue-800/30' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200/50 dark:ring-emerald-800/30' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200/50 dark:ring-amber-800/30' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200/50 dark:ring-violet-800/30' },
  };
  const c = colors[color];
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3.5 rounded-2xl border bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm transition-all ring-1',
        c.ring,
        onClick && 'hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] cursor-pointer',
      )}
    >
      <div className={cn('p-2.5 rounded-xl shadow-sm', c.bg)}>
        <Icon className={cn('w-4 h-4', c.text)} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub}</p>
      </div>
    </Component>
  );
}
