import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppRoleProvider } from "@/context/AppRoleContext";
import { AuthProvider } from "@/context/AuthContext";
import { MainLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGuard } from "@/components/auth/RoleGuard";
import Login from "@/pages/Auth/Login";
import { AnimatePresence, motion } from "framer-motion";

// Lazy load pages for performance optimization
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Bookings = lazy(() => import("./pages/Bookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Guests = lazy(() => import("./pages/Guests"));
const Payments = lazy(() => import("./pages/Payments"));
// Calendar page removed — redirects to Availability
const Availability = lazy(() => import("./pages/Availability"));
const Rates = lazy(() => import("./pages/Rates"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Billing = lazy(() => import("./pages/Billing"));
const Housekeeping = lazy(() => import("./pages/Housekeeping"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Expenses = lazy(() => import("./pages/Expenses"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
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
        {/* Dashboard — admin, reception */}
        <Route path="/" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Dashboard /></PageWrapper></RoleGuard>} />

        {/* Operaciones — admin, reception */}
        <Route path="/bookings" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Bookings /></PageWrapper></RoleGuard>} />
        <Route path="/bookings/:id" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><BookingDetail /></PageWrapper></RoleGuard>} />
        <Route path="/guests" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Guests /></PageWrapper></RoleGuard>} />
        <Route path="/guests/:id" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Guests /></PageWrapper></RoleGuard>} />
        <Route path="/availability" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Availability /></PageWrapper></RoleGuard>} />
        <Route path="/rates" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Rates /></PageWrapper></RoleGuard>} />

        {/* Habitaciones — admin, reception, housekeeping */}
        <Route path="/rooms" element={<RoleGuard allowedRoles={['admin', 'reception', 'housekeeping']}><PageWrapper><Rooms /></PageWrapper></RoleGuard>} />

        {/* Housekeeping — admin, housekeeping */}
        <Route path="/housekeeping" element={<RoleGuard allowedRoles={['admin', 'housekeeping']}><PageWrapper><Housekeeping /></PageWrapper></RoleGuard>} />

        {/* Finanzas — admin, reception, auditor */}
        <Route path="/payments" element={<RoleGuard allowedRoles={['admin', 'reception', 'auditor']}><PageWrapper><Payments /></PageWrapper></RoleGuard>} />
        <Route path="/expenses" element={<RoleGuard allowedRoles={['admin', 'reception', 'auditor']}><PageWrapper><Expenses /></PageWrapper></RoleGuard>} />
        <Route path="/billing" element={<RoleGuard allowedRoles={['admin', 'auditor']}><PageWrapper><Billing /></PageWrapper></RoleGuard>} />

        {/* Reportes — admin, auditor */}
        <Route path="/statistics" element={<RoleGuard allowedRoles={['admin', 'auditor']}><PageWrapper><Statistics /></PageWrapper></RoleGuard>} />
        <Route path="/audit-log" element={<RoleGuard allowedRoles={['admin', 'auditor']}><PageWrapper><AuditLog /></PageWrapper></RoleGuard>} />

        {/* Sistema */}
        <Route path="/notifications" element={<RoleGuard allowedRoles={['admin']}><PageWrapper><Notifications /></PageWrapper></RoleGuard>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />

        {/* Redirects */}
        <Route path="/calendar" element={<Navigate to="/availability" replace />} />
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <AppRoleProvider>
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
                        <Suspense fallback={<LoadingFallback />}>
                          <AnimatedRoutes />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppRoleProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
