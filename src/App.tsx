import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppRoleProvider } from "@/context/AppRoleContext";
import { AuthProvider } from "@/context/AuthContext";
import { MainLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import Login from "@/pages/Auth/Login";
import { AnimatePresence, motion } from "framer-motion";

// Lazy load pages for performance optimization
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Bookings = lazy(() => import("./pages/Bookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Guests = lazy(() => import("./pages/Guests"));
const Payments = lazy(() => import("./pages/Payments"));
// Availability page removed — room map is on Dashboard
const Rates = lazy(() => import("./pages/Rates"));
// Statistics and Billing removed — merged into Payments and Rates respectively
const Housekeeping = lazy(() => import("./pages/Housekeeping"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Expenses = lazy(() => import("./pages/Expenses"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const QuickCheckin = lazy(() => import("./pages/QuickCheckin"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
        <Route path="/quick-checkin/:id" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><QuickCheckin /></PageWrapper></RoleGuard>} />
        <Route path="/guests" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Guests /></PageWrapper></RoleGuard>} />
        <Route path="/guests/:id" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Guests /></PageWrapper></RoleGuard>} />
        {/* Availability removed — room map on Dashboard */}
        <Route path="/rates" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Rates /></PageWrapper></RoleGuard>} />

        {/* Habitaciones — admin, reception, housekeeping */}
        <Route path="/rooms" element={<RoleGuard allowedRoles={['admin', 'reception', 'housekeeping']}><PageWrapper><Rooms /></PageWrapper></RoleGuard>} />

        {/* Housekeeping — admin, housekeeping */}
        <Route path="/housekeeping" element={<RoleGuard allowedRoles={['admin', 'housekeeping']}><PageWrapper><Housekeeping /></PageWrapper></RoleGuard>} />

        {/* Finanzas — admin, reception, auditor */}
        <Route path="/payments" element={<RoleGuard allowedRoles={['admin', 'reception', 'auditor']}><PageWrapper><Payments /></PageWrapper></RoleGuard>} />
        <Route path="/expenses" element={<RoleGuard allowedRoles={['admin', 'reception', 'auditor']}><PageWrapper><Expenses /></PageWrapper></RoleGuard>} />
        <Route path="/billing" element={<Navigate to="/payments" replace />} />
        <Route path="/statistics" element={<Navigate to="/rates" replace />} />
        <Route path="/audit-log" element={<RoleGuard allowedRoles={['admin', 'auditor']}><PageWrapper><AuditLog /></PageWrapper></RoleGuard>} />

        {/* Sistema */}
        <Route path="/notifications" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Notifications /></PageWrapper></RoleGuard>} />
        <Route path="/settings" element={<RoleGuard allowedRoles={['admin', 'reception']}><PageWrapper><Settings /></PageWrapper></RoleGuard>} />

        {/* Redirects */}
        <Route path="/calendar" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-[70vh] w-full">
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>
    </div>
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
                        <ErrorBoundary>
                          <Suspense fallback={<LoadingFallback />}>
                            <AnimatedRoutes />
                          </Suspense>
                        </ErrorBoundary>
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
