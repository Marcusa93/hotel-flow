import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HotelProvider } from "@/context/HotelContext";
import { MainLayout } from "@/components/layout";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import Rooms from "./pages/Rooms";
import Guests from "./pages/Guests";
import Payments from "./pages/Payments";
import Calendar from "./pages/Calendar";
import Availability from "./pages/Availability";
import Rates from "./pages/Rates";
import Statistics from "./pages/Statistics";
import Billing from "./pages/Billing";
import Housekeeping from "./pages/Housekeeping";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <HotelProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout><Dashboard /></MainLayout>} />
            <Route path="/bookings" element={<MainLayout><Bookings /></MainLayout>} />
            <Route path="/bookings/:id" element={<MainLayout><BookingDetail /></MainLayout>} />
            <Route path="/rooms" element={<MainLayout><Rooms /></MainLayout>} />
            <Route path="/guests" element={<MainLayout><Guests /></MainLayout>} />
            <Route path="/guests/:id" element={<MainLayout><Guests /></MainLayout>} />
            <Route path="/payments" element={<MainLayout><Payments /></MainLayout>} />
            <Route path="/calendar" element={<MainLayout><Calendar /></MainLayout>} />
            <Route path="/availability" element={<MainLayout><Availability /></MainLayout>} />
            <Route path="/rates" element={<MainLayout><Rates /></MainLayout>} />
            <Route path="/statistics" element={<MainLayout><Statistics /></MainLayout>} />
            <Route path="/billing" element={<MainLayout><Billing /></MainLayout>} />
            <Route path="/housekeeping" element={<MainLayout><Housekeeping /></MainLayout>} />
            <Route path="/notifications" element={<MainLayout><Notifications /></MainLayout>} />
            <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </HotelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
