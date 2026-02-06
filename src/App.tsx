import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HotelProvider } from "@/context/HotelContext";
import { MainLayout } from "@/components/layout";
import { AnimatePresence, motion } from "framer-motion";

// Lazy load pages for performance optimization
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Bookings = lazy(() => import("./pages/Bookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Guests = lazy(() => import("./pages/Guests"));
const Payments = lazy(() => import("./pages/Payments"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Availability = lazy(() => import("./pages/Availability"));
const Rates = lazy(() => import("./pages/Rates"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Billing = lazy(() => import("./pages/Billing"));
const Housekeeping = lazy(() => import("./pages/Housekeeping"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<MainLayout><PageWrapper><Dashboard /></PageWrapper></MainLayout>} />
        <Route path="/bookings" element={<MainLayout><PageWrapper><Bookings /></PageWrapper></MainLayout>} />
        <Route path="/bookings/:id" element={<MainLayout><PageWrapper><BookingDetail /></PageWrapper></MainLayout>} />
        <Route path="/rooms" element={<MainLayout><PageWrapper><Rooms /></PageWrapper></MainLayout>} />
        <Route path="/guests" element={<MainLayout><PageWrapper><Guests /></PageWrapper></MainLayout>} />
        <Route path="/guests/:id" element={<MainLayout><PageWrapper><Guests /></PageWrapper></MainLayout>} />
        <Route path="/payments" element={<MainLayout><PageWrapper><Payments /></PageWrapper></MainLayout>} />
        <Route path="/calendar" element={<MainLayout><PageWrapper><Calendar /></PageWrapper></MainLayout>} />
        <Route path="/availability" element={<MainLayout><PageWrapper><Availability /></PageWrapper></MainLayout>} />
        <Route path="/rates" element={<MainLayout><PageWrapper><Rates /></PageWrapper></MainLayout>} />
        <Route path="/statistics" element={<MainLayout><PageWrapper><Statistics /></PageWrapper></MainLayout>} />
        <Route path="/billing" element={<MainLayout><PageWrapper><Billing /></PageWrapper></MainLayout>} />
        <Route path="/housekeeping" element={<MainLayout><PageWrapper><Housekeeping /></PageWrapper></MainLayout>} />
        <Route path="/notifications" element={<MainLayout><PageWrapper><Notifications /></PageWrapper></MainLayout>} />
        <Route path="/settings" element={<MainLayout><PageWrapper><Settings /></PageWrapper></MainLayout>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-full bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <HotelProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <AnimatedRoutes />
          </Suspense>
        </BrowserRouter>
      </HotelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
