import { useHotel } from '@/context/HotelContext';
import {
  DashboardHeader,
  StatsOverview,
  LiveActivityFeed,
  RevenueChart,
  OccupancyWidget,
  VIPArrivalsWidget
} from '@/components/dashboard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const {
    getDashboardStats,
    rooms,
    guests,
    getOccupancyByType
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

  // Mock Graph Data (would generally mean 7 days history)
  const revenueData = [
    { name: 'Lun', value: 4000 },
    { name: 'Mar', value: 3000 },
    { name: 'Mie', value: 2000 },
    { name: 'Jue', value: 2780 },
    { name: 'Vie', value: 1890 },
    { name: 'Sab', value: 2390 },
    { name: 'Dom', value: 3490 },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto px-6 py-6 pb-20">
      <div className="max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DashboardHeader onNewBooking={() => navigate('/bookings/new')} />
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
            adr={18500} // Mock ADR
          />
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
            <RevenueChart data={revenueData} />
            {/* VIP Arrivals Nested Here for Mobile/Tablet flow, but could be separate */}
          </motion.div>

          {/* Right Column (Operational Widgets) */}
          <motion.div
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <OccupancyWidget stats={occupancyStats} />
            <VIPArrivalsWidget />
            <LiveActivityFeed />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
