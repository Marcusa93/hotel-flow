import { useMemo } from 'react';
import { useHotel } from '@/context/HotelContext';
import {
  DashboardHeader,
  StatsOverview,
  LiveActivityFeed,
  RevenueChart,
  OccupancyWidget,
  UpcomingArrivalsWidget,
  QuickActions
} from '@/components/dashboard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRevenueStats } from '@/hooks/useRevenueStats';
import { format, isToday, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const {
    getDashboardStats,
    rooms,
    guests,
    bookings,
  } = useHotel();

  const navigate = useNavigate();
  const stats = getDashboardStats();

  // Calculate today's check-ins and check-outs
  const { todayCheckIns, todayCheckOuts } = useMemo(() => {
    const today = startOfDay(new Date());

    const checkIns = bookings.filter(b => {
      const checkInDate = new Date(b.checkInDate);
      return isToday(checkInDate) && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
    }).length;

    const checkOuts = bookings.filter(b => {
      const checkOutDate = new Date(b.checkOutDate);
      return isToday(checkOutDate) && b.status === 'CHECKED_IN';
    }).length;

    return { todayCheckIns: checkIns, todayCheckOuts: checkOuts };
  }, [bookings]);

  // Derived Data for Widgets
  const occupancyStats = {
    clean: rooms.filter(r => r.status === 'AVAILABLE').length,
    dirty: rooms.filter(r => r.status === 'DIRTY').length,
    occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
    maintenance: rooms.filter(r => r.status === 'MAINTENANCE').length,
  };

  const { data: revenueStats, isLoading: isLoadingRevenue } = useRevenueStats(7);

  const revenueData = revenueStats?.map(stat => ({
    name: format(new Date(stat.date), 'EEE', { locale: es }),
    value: stat.revenue
  })) || [];

  // Calculate real ADR from recent bookings
  const adr = useMemo(() => {
    const recentOccupied = bookings.filter(b =>
      b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT'
    );
    if (recentOccupied.length === 0) return 0;
    const totalRevenue = recentOccupied.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalNights = recentOccupied.reduce((sum, b) => {
      const nights = Math.ceil(
        (new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + nights;
    }, 0);
    return totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0;
  }, [bookings]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto px-4 md:px-6 py-6 pb-20 relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full space-y-6">

        {/* Header - Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DashboardHeader
            onNewBooking={() => navigate('/bookings?new=true')}
            todayCheckIns={todayCheckIns}
            todayCheckOuts={todayCheckOuts}
          />
        </motion.div>

        {/* Core Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatsOverview
            occupancyRate={stats.occupancyRate}
            monthlyRevenue={stats.monthlyRevenue}
            totalGuests={guests.length}
            adr={adr}
            availableRooms={occupancyStats.clean}
            isLoading={isLoadingRevenue}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <QuickActions />
        </motion.div>

        {/* Main Grid: Charts & Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Left Column (Charts) */}
          <motion.div
            className="lg:col-span-4 space-y-6"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <RevenueChart data={revenueData} isLoading={isLoadingRevenue} />
            <UpcomingArrivalsWidget />
          </motion.div>

          {/* Right Column (Operational Widgets) */}
          <motion.div
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <OccupancyWidget stats={occupancyStats} />
            <LiveActivityFeed />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
