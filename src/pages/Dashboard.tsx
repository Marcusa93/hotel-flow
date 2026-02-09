import { useHotel } from '@/context/HotelContext';
import {
  DashboardHeader,
  StatsOverview,
  LiveActivityFeed,
  RevenueChart,
  OccupancyWidget,
  VIPArrivalsWidget,
  QuickActions
} from '@/components/dashboard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRevenueStats } from '@/hooks/useRevenueStats';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const {
    getDashboardStats,
    rooms,
    guests,
  } = useHotel();

  const navigate = useNavigate();
  const stats = getDashboardStats();

  // Derived Data for Widgets
  const occupancyStats = {
    clean: rooms.filter(r => r.status === 'AVAILABLE').length,
    dirty: rooms.filter(r => r.status === 'DIRTY').length,
    occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
    maintenance: rooms.filter(r => r.status === 'MAINTENANCE').length,
  };

  const { data: revenueStats, isLoading: isLoadingRevenue } = useRevenueStats(7);

  const revenueData = revenueStats?.map(stat => ({
    name: format(new Date(stat.date), 'EEE', { locale: es }), // Lun, Mar, etc.
    value: stat.revenue
  })) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto px-6 py-6 pb-20 relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DashboardHeader onNewBooking={() => navigate('/bookings/new')} />
        </motion.div>

        {/* Quick Actions & Overview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div className="lg:col-span-4">
            <QuickActions />
          </div>
        </motion.div>


        {/* Core Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsOverview
            occupancyRate={stats.occupancyRate}
            monthlyRevenue={stats.monthlyRevenue}
            totalGuests={guests.length}
            adr={18500} // Mock ADR
            isLoading={isLoadingRevenue}
          />
        </motion.div>

        {/* Main Grid: Charts & Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Left Column (Charts) */}
          <motion.div
            className="lg:col-span-4 space-y-6"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <RevenueChart data={revenueData} isLoading={isLoadingRevenue} />
            <VIPArrivalsWidget />
          </motion.div>

          {/* Right Column (Operational Widgets) */}
          <motion.div
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <OccupancyWidget stats={occupancyStats} />
            <LiveActivityFeed />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
