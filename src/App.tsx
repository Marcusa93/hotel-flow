import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HotelProvider } from "@/context/HotelContext";
import { AuthProvider } from "@/context/AuthContext";
import { MainLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "@/pages/Auth/Login";
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
const Expenses = lazy(() => import("./pages/Expenses"));
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
        <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/bookings" element={<PageWrapper><Bookings /></PageWrapper>} />
        <Route path="/bookings/:id" element={<PageWrapper><BookingDetail /></PageWrapper>} />
        <Route path="/rooms" element={<PageWrapper><Rooms /></PageWrapper>} />
        <Route path="/guests" element={<PageWrapper><Guests /></PageWrapper>} />
        <Route path="/guests/:id" element={<PageWrapper><Guests /></PageWrapper>} />
        <Route path="/payments" element={<PageWrapper><Payments /></PageWrapper>} />
        <Route path="/calendar" element={<PageWrapper><Calendar /></PageWrapper>} />
        <Route path="/availability" element={<PageWrapper><Availability /></PageWrapper>} />
        <Route path="/rates" element={<PageWrapper><Rates /></PageWrapper>} />
        <Route path="/statistics" element={<PageWrapper><Statistics /></PageWrapper>} />
        <Route path="/billing" element={<PageWrapper><Billing /></PageWrapper>} />
        <Route path="/housekeeping" element={<PageWrapper><Housekeeping /></PageWrapper>} />
        <Route path="/notifications" element={<PageWrapper><Notifications /></PageWrapper>} />
        <Route path="/expenses" element={<PageWrapper><Expenses /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
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
    <AuthProvider>
      <HotelProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <AnimatedRoutes />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </HotelProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
